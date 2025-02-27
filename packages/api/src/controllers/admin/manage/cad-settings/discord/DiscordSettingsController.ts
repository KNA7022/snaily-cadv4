import process from "node:process";
import { BodyParams, Context, Controller, UseBeforeEach } from "@tsed/common";
import { Get, Post } from "@tsed/schema";
import { RESTGetAPIGuildRolesResult, Routes } from "discord-api-types/v10";
import { IsAuth } from "middlewares/IsAuth";
import { prisma } from "lib/prisma";
import type { cad, DiscordRole } from "@prisma/client";
import { BadRequest } from "@tsed/exceptions";
import { DISCORD_SETTINGS_SCHEMA } from "@snailycad/schemas";
import { validateSchema } from "lib/validateSchema";
import { getRest } from "lib/discord/config";
import { manyToManyHelper } from "utils/manyToMany";

const guildId = process.env.DISCORD_SERVER_ID;

@Controller("/admin/manage/cad-settings/discord")
@UseBeforeEach(IsAuth)
export class DiscordSettingsController {
  @Get("/")
  async getGuildRoles(@Context("cad") cad: cad) {
    if (!guildId) {
      throw new BadRequest("mustSetBotTokenGuildId");
    }

    const rest = getRest();
    const roles = (await rest.get(Routes.guildRoles(guildId))) as RESTGetAPIGuildRolesResult | null;

    const discordRoles = await prisma.discordRoles.upsert({
      where: { id: String(cad.discordRolesId) },
      update: { guildId },
      create: {
        guildId,
      },
    });

    await prisma.cad.update({
      where: { id: cad.id },
      data: { discordRolesId: discordRoles.id },
    });

    const rolesBody = Array.isArray(roles) ? roles : [];
    const data = [];

    for (const role of rolesBody) {
      if (role.name === "@everyone") continue;

      const discordRole = await prisma.discordRole.upsert({
        where: { id: role.id },
        create: {
          name: role.name,
          id: role.id,
          discordRolesId: discordRoles.id,
        },
        update: {
          name: role.name,
          discordRolesId: discordRoles.id,
        },
      });

      data.push(discordRole);
    }

    return data;
  }

  @Post("/")
  async setRoleTypes(@Context("cad") cad: cad, @BodyParams() body: unknown) {
    if (!guildId) {
      throw new BadRequest("mustSetBotTokenGuildId");
    }

    const data = validateSchema(DISCORD_SETTINGS_SCHEMA, body);

    const rest = getRest();
    const roles = (await rest.get(Routes.guildRoles(guildId))) as RESTGetAPIGuildRolesResult | null;

    const rolesBody = Array.isArray(roles) ? roles : [];

    const rolesToCheck = {
      leoRoles: data.leoRoles,
      emsFdRoles: data.emsFdRoles,
      leoSupervisorRoles: data.leoSupervisorRoles,
      dispatchRoles: data.dispatchRoles,
      towRoles: data.towRoles,
      taxiRoles: data.taxiRoles,
      adminRoleId: data.adminRoleId,
      whitelistedRoleId: data.whitelistedRoleId,
    };

    Object.values(rolesToCheck).map((roleId) => {
      if (Array.isArray(roleId) && roleId.length <= 0) return;

      if (roleId && !this.doesRoleExist(rolesBody, roleId)) {
        throw new BadRequest("invalidRoleId");
      }
    });

    const createUpdateData = {
      guildId,
      adminRoleId: data.adminRoleId ?? null,
      whitelistedRoleId: data.whitelistedRoleId ?? null,
      adminRolePermissions: data.adminRolePermissions ?? [],
      leoRolePermissions: data.leoRolePermissions ?? [],
      leoSupervisorRolePermissions: data.leoSupervisorRolePermissions ?? [],
      emsFdRolePermissions: data.emsFdRolePermissions ?? [],
      dispatchRolePermissions: data.dispatchRolePermissions ?? [],
      towRolePermissions: data.towRolePermissions ?? [],
      taxiRolePermissions: data.taxiRolePermissions ?? [],
    };

    const discordRoles = await prisma.discordRoles.upsert({
      where: { id: String(cad.discordRolesId) },
      update: createUpdateData,
      create: createUpdateData,
      include: {
        leoRoles: true,
        emsFdRoles: true,
        leoSupervisorRoles: true,
        towRoles: true,
        taxiRoles: true,
        dispatchRoles: true,
      },
    });

    await Promise.all([
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.leoRoles,
        newRoles: (data.leoRoles as string[] | null) ?? [],
        type: "leoRoles",
      }),
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.emsFdRoles,
        newRoles: (data.emsFdRoles as string[] | null) ?? [],
        type: "emsFdRoles",
      }),
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.leoSupervisorRoles,
        newRoles: (data.leoSupervisorRoles as string[] | null) ?? [],
        type: "leoSupervisorRoles",
      }),
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.towRoles,
        newRoles: (data.towRoles as string[] | null) ?? [],
        type: "towRoles",
      }),
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.dispatchRoles,
        newRoles: (data.dispatchRoles as string[] | null) ?? [],
        type: "dispatchRoles",
      }),
      this.updateRoles({
        discordRoleId: discordRoles.id,
        discordRoles: discordRoles.taxiRoles,
        newRoles: (data.taxiRoles as string[] | null) ?? [],
        type: "taxiRoles",
      }),
    ]);

    const updated = await prisma.cad.update({
      where: { id: cad.id },
      data: { discordRolesId: discordRoles.id },
      include: { discordRoles: { include: { roles: true, leoRoles: true, emsFdRoles: true } } },
    });

    return updated.discordRoles;
  }

  protected doesRoleExist(roles: { id: string }[], roleId: string | string[]) {
    return roles.some((v) =>
      typeof roleId === "string" ? v.id === roleId : roleId.includes(v.id),
    );
  }

  protected async updateRoles(options: UpdateRolesOptions) {
    const disconnectConnectArr = manyToManyHelper(
      options.discordRoles.map((v) => v.id),
      options.newRoles,
    );

    await prisma.$transaction(
      disconnectConnectArr.map((v) =>
        prisma.discordRoles.update({
          where: { id: options.discordRoleId },
          data: { [options.type]: v },
        }),
      ),
    );
  }
}

interface UpdateRolesOptions {
  discordRoleId: string;
  discordRoles: DiscordRole[];
  newRoles: string[];
  type:
    | "leoRoles"
    | "emsFdRoles"
    | "leoSupervisorRoles"
    | "dispatchRoles"
    | "towRoles"
    | "taxiRoles";
}
