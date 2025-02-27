import { Rank, User } from "@prisma/client";
import { hasPermission, Permissions } from "@snailycad/permissions";
import type { Req, Context } from "@tsed/common";
import { BadRequest, Forbidden, Unauthorized } from "@tsed/exceptions";
import { unitProperties } from "lib/leo/activeOfficer";
import { getInactivityFilter } from "./leo/utils";
import { prisma } from "./prisma";

export async function getActiveDeputy(
  req: Req,
  user: Pick<User, "rank" | "id" | "permissions" | "isEmsFd" | "isDispatch" | "isLeo">,
  ctx: Context,
) {
  // dispatch is allowed to use ems-fd routes
  let isDispatch = false;
  if (req.headers["is-from-dispatch"]?.toString() === "true") {
    const hasDispatchPermissions =
      hasPermission(user.permissions, [Permissions.Dispatch]) ||
      user.isDispatch ||
      user.rank === Rank.OWNER;

    if (!hasDispatchPermissions) {
      throw new Unauthorized("Must be dispatch to use this header.");
    } else {
      isDispatch = true;
    }
  } else {
    const hasEmsFdPermissions =
      user.rank === Rank.OWNER
        ? true
        : !user.permissions.length
        ? user.isEmsFd
        : hasPermission(user.permissions, [Permissions.EmsFd]);

    if (!hasEmsFdPermissions) {
      throw new Forbidden("Invalid Permissions");
    }
  }

  if (isDispatch) {
    return null;
  }

  const cad = await prisma.cad.findFirst({ include: { miscCadSettings: true } });
  const unitsInactivityFilter = getInactivityFilter(cad!, "lastStatusChangeTimestamp");

  const deputy = await prisma.emsFdDeputy.findFirst({
    where: {
      userId: user.id,
      lastStatusChangeTimestamp: unitsInactivityFilter
        ? { lte: unitsInactivityFilter.lastStatusChangeTimestamp }
        : undefined,
      NOT: {
        status: {
          shouldDo: "SET_OFF_DUTY",
        },
      },
    },
    include: unitProperties,
  });

  if (!deputy) {
    ctx.delete("activeDeputy");
    throw new BadRequest("noActiveDeputy");
  }

  return deputy;
}
