import {
  Controller,
  QueryParams,
  BodyParams,
  UseBefore,
  PathParams,
  Context,
  UseBeforeEach,
} from "@tsed/common";
import { Delete, Description, Get, Post, Put } from "@tsed/schema";
import { prisma } from "lib/prisma";
import { TOW_SCHEMA, UPDATE_TOW_SCHEMA } from "@snailycad/schemas";
import { NotFound } from "@tsed/exceptions";
import { IsAuth } from "middlewares/IsAuth";
import { Socket } from "services/SocketService";
import { validateSchema } from "lib/validateSchema";
import {
  Citizen,
  DiscordWebhookType,
  RegisteredVehicle,
  User,
  Value,
  VehicleValue,
} from "@prisma/client";
import { canManageInvariant } from "lib/auth/user";
import { Permissions, UsePermissions } from "middlewares/UsePermissions";
import { callInclude } from "controllers/dispatch/911-calls/Calls911Controller";
import { officerOrDeputyToUnit } from "lib/leo/officerOrDeputyToUnit";
import { sendDiscordWebhook } from "lib/discord/webhooks";

const CITIZEN_SELECTS = {
  name: true,
  surname: true,
  id: true,
};

export const towIncludes = {
  assignedUnit: { select: CITIZEN_SELECTS },
  creator: { select: CITIZEN_SELECTS },
};

@Controller("/tow")
@UseBeforeEach(IsAuth)
export class TowController {
  private socket: Socket;
  constructor(socket: Socket) {
    this.socket = socket;
  }

  @Get("/")
  @Description("Get all the tow calls")
  @UsePermissions({
    permissions: [Permissions.ManageTowCalls, Permissions.ViewTowCalls, Permissions.ViewTowLogs],
    fallback: (u) => u.isTow,
  })
  async getTowCalls(@QueryParams("ended") includingEnded = false) {
    const calls = await prisma.towCall.findMany({
      where: includingEnded ? undefined : { ended: false },
      include: towIncludes,
    });

    return calls;
  }

  @UseBefore(IsAuth)
  @Post("/")
  @Description("Create a new tow call")
  async createTowCall(@BodyParams() body: unknown, @Context("user") user: User) {
    const data = validateSchema(TOW_SCHEMA, body);

    if (data.creatorId) {
      const extraWhere = data.plate
        ? {
            OR: [
              { officers: { some: { citizenId: data.creatorId } } },
              { emsFdDeputies: { some: { citizenId: data.creatorId } } },
            ],
          }
        : {};

      const citizen = await prisma.citizen.findFirst({
        where: {
          id: data.creatorId,
          ...extraWhere,
        },
      });

      canManageInvariant(citizen?.userId, user, new NotFound("notFound"));
    }

    let vehicle;
    if (data.plate && data.deliveryAddress) {
      vehicle = await prisma.registeredVehicle.findUnique({
        where: { plate: data.plate },
        include: { model: { include: { value: true } } },
      });

      if (!vehicle) {
        throw new NotFound("vehicleNotFound");
      }

      await prisma.impoundedVehicle.create({
        data: {
          valueId: data.deliveryAddress,
          registeredVehicleId: vehicle.id,
        },
      });

      const impoundedVehicle = await prisma.registeredVehicle.update({
        where: {
          id: vehicle.id,
        },
        data: {
          impounded: true,
        },
        include: {
          model: { include: { value: true } },
          registrationStatus: true,
          citizen: true,
        },
      });

      try {
        const data = createWebhookData(impoundedVehicle);
        await sendDiscordWebhook(DiscordWebhookType.VEHICLE_IMPOUNDED, data);
      } catch (error) {
        console.error("Could not send Discord webhook.", error);
      }

      if (data.call911Id) {
        const call = await prisma.call911.findUnique({
          where: { id: data.call911Id },
          include: callInclude,
        });

        if (!call) return;

        const event = await prisma.call911Event.create({
          data: {
            description: "Created a tow call",
            call911Id: data.call911Id,
          },
        });

        const normalizedCall = officerOrDeputyToUnit({
          ...call,
          events: [...call.events, event],
        });

        this.socket.emitUpdate911Call(normalizedCall);
      }
    }

    const call = await prisma.towCall.create({
      data: {
        creatorId: data.creatorId,
        description: data.description,
        descriptionData: data.descriptionData,
        location: data.location,
        postal: data.postal,
        deliveryAddressId: data.deliveryAddress || null,
        plate: vehicle?.plate.toUpperCase() ?? null,
        model: vehicle?.model.value.value ?? null,
        ended: data.callCountyService || false,
        name: data.name ?? null,
      },
      include: towIncludes,
    });

    if (call.ended) {
      await this.socket.emitTowCallEnd(call);
    } else {
      await this.socket.emitTowCall(call);
    }

    return call;
  }

  @UseBefore(IsAuth)
  @Put("/:id")
  @Description("Update a tow call by its id")
  @UsePermissions({
    permissions: [Permissions.ManageTowCalls],
    fallback: (u) => u.isTow,
  })
  async updateCall(@PathParams("id") callId: string, @BodyParams() body: unknown) {
    const data = validateSchema(UPDATE_TOW_SCHEMA, body);

    const call = await prisma.towCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFound("notFound");
    }

    const rawAssignedUnitId = data.assignedUnitId;
    const assignedUnitId =
      rawAssignedUnitId === null
        ? { disconnect: true }
        : data.assignedUnitId
        ? { connect: { id: data.assignedUnitId } }
        : undefined;

    const updated = await prisma.towCall.update({
      where: { id: callId },
      data: {
        description: data.description,
        descriptionData: data.descriptionData,
        location: data.location,
        postal: data.postal ? String(data.postal) : null,
        assignedUnit: assignedUnitId,
        name: data.name ?? null,
      },
      include: towIncludes,
    });

    await this.socket.emitUpdateTowCall(updated);

    return updated;
  }

  @UseBefore(IsAuth)
  @Delete("/:id")
  @Description("Delete a tow call by its id")
  @UsePermissions({
    permissions: [Permissions.ManageTowCalls],
    fallback: (u) => u.isTow,
  })
  async endTowCall(@PathParams("id") callId: string) {
    const call = await prisma.towCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFound("notFound");
    }

    const updated = await prisma.towCall.update({
      where: { id: call.id },
      data: { ended: true },
      include: towIncludes,
    });

    await this.socket.emitTowCallEnd(updated);

    return true;
  }
}

function createWebhookData(
  vehicle: RegisteredVehicle & {
    model: VehicleValue & { value: Value };
    registrationStatus: Value;
    citizen: Pick<Citizen, "name" | "surname">;
  },
) {
  return {
    embeds: [
      {
        title: "Vehicle Impounded",
        fields: [
          { name: "Registration Status", value: vehicle.registrationStatus.value, inline: true },
          { name: "Model", value: vehicle.model.value.value, inline: true },
          {
            name: "Owner",
            value: `${vehicle.citizen.name} ${vehicle.citizen.surname}`,
            inline: true,
          },
        ],
      },
    ],
  };
}
