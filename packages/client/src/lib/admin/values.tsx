import { LICENSE_LABELS } from "components/admin/values/manage-modal/LicenseFields";
import { yesOrNoText } from "lib/utils";
import { useTranslations } from "next-intl";
import {
  type StatusValue,
  StatusValueType,
  ValueType,
  type DepartmentValue,
  type DivisionValue,
  type VehicleValue,
  type Value,
  WhatPages,
  ShouldDoType,
  QualificationValue,
} from "@snailycad/types";
import {
  SHOULD_DO_LABELS,
  useDefaultDepartments,
  WHAT_PAGES_LABELS,
} from "components/admin/values/manage-modal/StatusValueFields";
import { DEPARTMENT_LABELS } from "components/admin/values/manage-modal/DepartmentFields";
import { type AnyValue, isBaseValue } from "@snailycad/utils";
import { useImageUrl } from "hooks/useImageUrl";

const TYPE_LABELS = {
  [StatusValueType.SITUATION_CODE]: "Situation Code",
  [StatusValueType.STATUS_CODE]: "Status Code",
};

const DEFAULT_PAGES = [WhatPages.LEO, WhatPages.DISPATCH, WhatPages.EMS_FD];

export function makeDefaultWhatPages(
  status: (Omit<StatusValue, "whatPages"> & { whatPages: WhatPages[] | null }) | null,
) {
  if (!status) return [];
  const whatPages = status.whatPages ?? [];

  return whatPages.length <= 0 ? DEFAULT_PAGES : status.whatPages;
}

export function useTableDataOfType(type: ValueType) {
  const common = useTranslations("Common");
  const defaultDepartments = useDefaultDepartments();
  const { makeImageUrl } = useImageUrl();

  function get(value: AnyValue) {
    // state mismatch prevention
    const valueType = isBaseValue(value) ? value.type : value.value.type;
    if (valueType !== type) return;

    switch (type) {
      case ValueType.CODES_10: {
        const v = value as StatusValue;
        const whatPages = makeDefaultWhatPages(v);
        const departments = defaultDepartments(v);

        return {
          shouldDo: SHOULD_DO_LABELS[v.shouldDo],
          type: TYPE_LABELS[v.type],
          whatPages: whatPages?.map((v) => WHAT_PAGES_LABELS[v]).join(", "),
          departments:
            v.shouldDo === ShouldDoType.SET_ON_DUTY
              ? "—"
              : departments.map((v) => v.label).join(", "),
          color: v.color ? (
            <>
              <span
                style={{ background: v.color }}
                className="inline-block w-2.5 h-2.5 mr-2 rounded-full"
              />
              {v.color}
            </>
          ) : (
            common("none")
          ),
        };
      }
      case ValueType.DEPARTMENT: {
        const v = value as DepartmentValue;

        return {
          callsign: v.callsign || common("none"),
          type: DEPARTMENT_LABELS[v.type],
          whitelisted: common(yesOrNoText(v.whitelisted)),
          isDefaultDepartment: common(yesOrNoText(v.isDefaultDepartment)),
          defaultOfficerRank: v.defaultOfficerRank?.value ?? common("none"),
          isConfidential: common(yesOrNoText(v.isConfidential)),
        };
      }
      case ValueType.DIVISION: {
        const v = value as DivisionValue;

        return {
          callsign: v.callsign || common("none"),
          pairedUnitTemplate: v.pairedUnitTemplate ?? common("none"),
          department: v.department.value.value,
        };
      }
      case ValueType.VEHICLE:
      case ValueType.WEAPON: {
        const v = value as VehicleValue;

        return {
          gameHash: v.hash || common("none"),
        };
      }
      case ValueType.LICENSE: {
        const v = value as Value<ValueType.LICENSE>;

        return {
          licenseType: v.licenseType ? LICENSE_LABELS[v.licenseType] : common("none"),
          isDefault: common(yesOrNoText(v.isDefault)),
        };
      }
      case ValueType.QUALIFICATION: {
        const v = value as QualificationValue;
        const imgUrl = makeImageUrl("values", v.imageId);

        return {
          image: imgUrl ? (
            <img src={imgUrl} width={50} height={50} className="object-cover" />
          ) : (
            "—"
          ),
          departments: v.departments.map((v) => v.value.value).join(", "),
          type: v.qualificationType.toLowerCase(),
        };
      }
      case ValueType.OFFICER_RANK: {
        const v = value as Value<ValueType.OFFICER_RANK>;
        const imgUrl = makeImageUrl("values", v.officerRankImageId);

        return {
          image: imgUrl ? (
            <img src={imgUrl} width={50} height={50} className="object-cover" />
          ) : (
            "—"
          ),
        };
      }
      default: {
        return {};
      }
    }
  }

  return get;
}

export function useTableHeadersOfType(type: ValueType) {
  const common = useTranslations("Common");
  const t = useTranslations("Values");

  switch (type) {
    case ValueType.CODES_10: {
      return [
        { Header: t("shouldDo"), accessor: "shouldDo" },
        { Header: common("type"), accessor: "type" },
        { Header: t("color"), accessor: "color" },
        { Header: t("whatPages"), accessor: "whatPages" },
        { Header: t("departments"), accessor: "departments" },
      ];
    }
    case ValueType.DEPARTMENT: {
      return [
        { Header: t("callsign"), accessor: "callsign" },
        { Header: common("type"), accessor: "type" },
        { Header: t("whitelisted"), accessor: "whitelisted" },
        { Header: t("isDefaultDepartment"), accessor: "isDefaultDepartment" },
        { Header: t("defaultOfficerRank"), accessor: "defaultOfficerRank" },
        { Header: t("isConfidential"), accessor: "isConfidential" },
      ];
    }
    case ValueType.DIVISION: {
      return [
        { Header: t("callsign"), accessor: "callsign" },
        { Header: t("department"), accessor: "department" },
        { Header: t("pairedUnitTemplate"), accessor: "pairedUnitTemplate" },
      ];
    }
    case ValueType.VEHICLE:
    case ValueType.WEAPON: {
      return [{ Header: t("gameHash"), accessor: "gameHash" }];
    }
    case ValueType.LICENSE: {
      return [
        { Header: t("licenseType"), accessor: "licenseType" },
        { Header: t("isDefault"), accessor: "isDefault" },
      ];
    }
    case ValueType.QUALIFICATION: {
      return [
        { Header: common("image"), accessor: "image" },
        { Header: t("departments"), accessor: "departments" },
        { Header: common("type"), accessor: "type" },
      ];
    }
    case ValueType.OFFICER_RANK: {
      return [{ Header: common("image"), accessor: "image" }];
    }
    default: {
      return [];
    }
  }
}
