import { Controller } from "@tsed/di";
import { Post } from "@tsed/schema";
import { prisma } from "lib/prisma";
import { BodyParams, MultipartFile, PlatformMulterFile } from "@tsed/common";
import { parseImportFile } from "utils/file";
import { validateSchema } from "lib/validateSchema";
import { generateString } from "utils/generateString";
import { IMPORT_CITIZENS_ARR } from "@snailycad/schemas/dist/admin/import/citizens";
import { importVehiclesHandler } from "./ImportVehiclesController";
import { importWeaponsHandler } from "./ImportWeaponsController";
import { updateCitizenLicenseCategories } from "lib/citizen/licenses";
import { manyToManyHelper } from "utils/manyToMany";

@Controller("/admin/import/citizens")
export class ImportCitizensController {
  @Post("/")
  async importCitizens(
    @BodyParams() body: unknown,
    @MultipartFile("file") file?: PlatformMulterFile,
  ) {
    const toValidateBody = file ? parseImportFile(file) : body;
    const data = validateSchema(IMPORT_CITIZENS_ARR, toValidateBody);

    return Promise.all(
      data.map(async (data) => {
        const citizen = await prisma.citizen.create({
          data: {
            userId: data.userId ?? undefined,
            name: data.name,
            surname: data.surname,
            ethnicityId: data.ethnicity,
            genderId: data.gender,
            dateOfBirth: new Date(data.dateOfBirth),
            address: data.address ?? "",
            eyeColor: data.eyeColor ?? "",
            hairColor: data.hairColor ?? "",
            height: data.height ?? "",
            weight: data.weight ?? "",
            socialSecurityNumber: generateString(9, { numbersOnly: true }),
            weaponLicenseId: data.weaponLicenseId ?? null,
            driversLicenseId: data.driversLicenseId ?? null,
            pilotLicenseId: data.pilotLicenseId ?? null,
            postal: data.postal ?? null,
            phoneNumber: data.phoneNumber ?? null,
          },
          include: { gender: true, ethnicity: true },
        });

        if (data.vehicles) {
          await importVehiclesHandler(data.vehicles.map((v) => ({ ...v, ownerId: citizen.id })));
        }

        if (data.weapons) {
          await importWeaponsHandler(data.weapons.map((v) => ({ ...v, ownerId: citizen.id })));
        }

        if (data.flags) {
          const disconnectConnectArr = manyToManyHelper([], data.flags);

          await prisma.$transaction(
            disconnectConnectArr.map((v) =>
              prisma.citizen.update({ where: { id: citizen.id }, data: { flags: v } }),
            ),
          );
        }

        const licenseData = {
          driversLicenseCategory: data.driversLicenseCategoryIds,
          pilotLicenseCategory: data.pilotLicenseCategoryIds,
          waterLicenseCategory: data.waterLicenseCategoryIds,
          firearmLicenseCategory: data.firearmLicenseCategoryIds,
        };

        const updated = await updateCitizenLicenseCategories(citizen, licenseData, {
          gender: true,
          ethnicity: true,
          weaponLicense: true,
          driversLicense: true,
          pilotLicense: true,
          waterLicense: true,
          dlCategory: { include: { value: true } },
        });

        return updated;
      }),
    );
  }
}
