import process from "node:process";
import { Context, Delete, Get, QueryParams, Req, Res, UseBefore } from "@tsed/common";
import { BadRequest } from "@tsed/exceptions";
import { Controller } from "@tsed/di";
import { URL } from "node:url";
import { prisma } from "lib/prisma";
import { Rank, User, WhitelistStatus } from "@prisma/client";
import { IsAuth } from "middlewares/IsAuth";
import { Description } from "@tsed/schema";
import { request } from "undici";
import { findRedirectURL, findUrl } from "./Discord";
import { getSessionUser } from "lib/auth/user";
import { signJWT } from "utils/jwt";
import {
  AUTH_TOKEN_EXPIRES_MS,
  AUTH_TOKEN_EXPIRES_S,
  getDefaultPermissionsForNewUser,
} from "./Auth";
import { setCookie } from "utils/setCookie";
import { Cookie } from "@snailycad/config";

const callbackUrl = makeCallbackURL(findUrl());
const STEAM_API_KEY = process.env["STEAM_API_KEY"];
export const STEAM_API_URL = "https://api.steampowered.com";

@Controller("/auth/steam")
export class SteamOAuthController {
  @Get("/")
  @Description("Redirect to Steam's OAuth2 URL")
  async handleRedirectToSteamOAuthAPI(@Res() res: Res) {
    if (!STEAM_API_KEY) {
      throw new BadRequest(
        "No `STEAM_API_KEY` was specified in the .env file. Please refer to the documentation: https://cad-docs.caspertheghost.me/docs/steam-integration/steam-authentication",
      );
    }

    const url = `https://steamcommunity.com/openid/login?openid.mode=checkid_setup&openid.ns=http://specs.openid.net/auth/2.0&openid.ns.sreg=http://openid.net/extensions/sreg/1.1&openid.sreg.optional=nickname,email,fullname,dob,gender,postcode,country,language,timezone&openid.ns.ax=http://openid.net/srv/ax/1.0&openid.ax.mode=fetch_request&openid.ax.type.fullname=http://axschema.org/namePerson&openid.ax.type.firstname=http://axschema.org/namePerson/first&openid.ax.type.email=http://axschema.org/contact/email&openid.ax.required=fullname,email&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select&openid.return_to=${callbackUrl}&openid.realm=${callbackUrl}`;
    return res.redirect(301, url);
  }

  @Get("/callback")
  @Description("Handle Steam's OAuth2 response. Authenticate user where possible.")
  async handleCallbackFromSteam(@QueryParams() query: any, @Res() res: Res, @Req() req: Req) {
    req;
    const redirectURL = findRedirectURL();
    const identity = query["openid.identity"];

    const rawSteamId = identity?.replace("https://steamcommunity.com/openid/id/", "");
    if (!rawSteamId) {
      return res.redirect(`${redirectURL}/auth/login?error=invalidCode`);
    }

    const users = await prisma.user.count();
    if (users <= 0) {
      return res.redirect(`${redirectURL}/auth/login?error=cannotRegisterFirstWithDiscord`);
    }

    const [steamData, authUser, cad] = await Promise.all([
      getSteamData(rawSteamId),
      getSessionUser(req, false),
      prisma.cad.findFirst({ include: { autoSetUserProperties: true } }),
    ]);

    const steamId = steamData.steamid;
    const steamUsername = steamData.personaname;

    const user = await prisma.user.findFirst({
      where: { steamId: steamData.steamid },
    });

    /**
     * a user was found with the steamId, but the user is not authenticated.
     *
     * -> log the user in and set the cookie
     */
    if (!authUser && user) {
      validateUser(user);

      // authenticate user with cookie
      const jwtToken = signJWT({ userId: user.id }, AUTH_TOKEN_EXPIRES_S);
      setCookie({
        res,
        name: Cookie.Session,
        expires: AUTH_TOKEN_EXPIRES_MS,
        value: jwtToken,
      });

      return res.redirect(`${redirectURL}/citizen`);
    }

    /**
     * there is no user authenticated and there is no user with the steamId already registered
     *
     * -> register the account and set cookie
     */
    if (!user && !authUser) {
      const existingUserWithUsername = await prisma.user.findUnique({
        where: { username: steamUsername },
      });

      if (existingUserWithUsername) {
        return res.redirect(`${redirectURL}/auth/login?error=steamNameInUse`);
      }

      const user = await prisma.user.create({
        data: {
          username: steamUsername,
          password: "",
          steamId,
          permissions: getDefaultPermissionsForNewUser(cad),
          whitelistStatus: cad?.whitelisted ? WhitelistStatus.PENDING : WhitelistStatus.ACCEPTED,
        },
      });

      validateUser(user);

      const jwtToken = signJWT({ userId: user.id }, AUTH_TOKEN_EXPIRES_S);
      setCookie({
        res,
        name: Cookie.Session,
        expires: AUTH_TOKEN_EXPIRES_MS,
        value: jwtToken,
      });

      return res.redirect(`${redirectURL}/citizen`);
    }

    if (authUser && user) {
      if (user.id === authUser.id) {
        const updated = await prisma.user.update({
          where: { id: authUser.id },
          data: { steamId },
        });

        validateUser(updated);

        return res.redirect(`${redirectURL}/account?tab=discord&success`);
      }

      return res.redirect(`${redirectURL}/account?tab=discord&error=steamAccountAlreadyLinked`);
    }

    if (authUser && !user) {
      const updated = await prisma.user.update({
        where: { id: authUser.id },
        data: { steamId },
      });

      validateUser(updated);

      return res.redirect(`${redirectURL}/account?tab=discord&success`);
    }

    return steamData;

    function validateUser(user: User) {
      if (user.rank !== Rank.OWNER) {
        if (user.banned) {
          return res.redirect(`${redirectURL}/auth/login?error=userBanned`);
        }

        if (user.whitelistStatus === WhitelistStatus.PENDING) {
          return res.redirect(`${redirectURL}/auth/login?error=whitelistPending`);
        }

        if (user.whitelistStatus === WhitelistStatus.DECLINED) {
          return res.redirect(`${redirectURL}/auth/login?error=whitelistDeclined`);
        }
      }
    }
  }

  @Delete("/")
  @UseBefore(IsAuth)
  @Description("Remove Steam OAuth2 from the authenticated user")
  async removeSteamOauth(@Context("user") user: User) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        steamId: null,
      },
    });

    return true;
  }
}

async function getSteamData(steamId: string) {
  const data = await request(
    `${STEAM_API_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`,
    {
      method: "GET",
      headers: { accept: "application/json" },
    },
  ).then((v) => v.body.json());

  return data?.response?.players[0];
}

function makeCallbackURL(base: string) {
  return `${new URL(base)}/auth/steam/callback`;
}
