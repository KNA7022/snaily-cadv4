import { Permissions } from "../permissions";

export const defaultManagementPermissions = [
  Permissions.ViewUsers,
  Permissions.ManageUsers,
  Permissions.BanUsers,
  Permissions.DeleteUsers,
  Permissions.ViewCitizens,
  Permissions.ManageCitizens,
  Permissions.DeleteCitizens,
  Permissions.ViewUnits,
  Permissions.ManageUnits,
  Permissions.DeleteUnits,
  Permissions.ManageUnitCallsigns,
  Permissions.ViewBusinesses,
  Permissions.ManageBusinesses,
  Permissions.DeleteBusinesses,
  Permissions.ViewExpungementRequests,
  Permissions.ManageExpungementRequests,
  Permissions.ViewNameChangeRequests,
  Permissions.ManageNameChangeRequests,
  Permissions.ViewCustomFields,
  Permissions.ManageCustomFields,
];

export const defaultImportPermissions = [
  Permissions.ImportCitizens,
  Permissions.ImportRegisteredVehicles,
  Permissions.ImportRegisteredWeapons,
];

export const defaultValuePermissions = [
  Permissions.ManageValueLicense,
  Permissions.ManageValueGender,
  Permissions.ManageValueEthnicity,
  Permissions.ManageValueVehicle,
  Permissions.ManageValueWeapon,
  Permissions.ManageValueBloodGroup,
  Permissions.ManageValueBusinessRole,
  Permissions.ManageValueCodes10,
  Permissions.ManageValuePenalCode,
  Permissions.ManageValueDepartment,
  Permissions.ManageValueOfficerRank,
  Permissions.ManageValueDivision,
  Permissions.ManageValueDLCategory,
  Permissions.ManageValueImpoundLot,
  Permissions.ManageValueVehicleFlag,
  Permissions.ManageValueCitizenFlag,
  Permissions.ManageValueQualification,
];

export const allDefaultAdminPermissions = [
  ...defaultManagementPermissions,
  ...defaultImportPermissions,
  ...defaultValuePermissions,
];
