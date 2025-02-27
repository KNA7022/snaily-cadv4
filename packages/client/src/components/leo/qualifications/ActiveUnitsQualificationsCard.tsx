import * as React from "react";
import type { CombinedLeoUnit, EmsFdDeputy, Officer, UnitQualification } from "@snailycad/types";
import { useHoverDirty } from "react-use";
import { isUnitCombined } from "@snailycad/utils";
import { HoverCard } from "components/shared/HoverCard";
import useFetch from "lib/useFetch";
import create from "zustand";
import { Loader } from "components/Loader";
import { UnitQualificationsTable } from "./UnitQualificationsTable";

interface Props {
  unit: ((Officer | EmsFdDeputy) & { qualifications?: UnitQualification[] }) | CombinedLeoUnit;
  children: React.ReactNode;
  canBeOpened?: boolean;
}

interface CacheStore {
  units: Record<string, UnitQualification[]>;
  setUnits(units: CacheStore["units"]): void;
}

const useCacheStore = create<CacheStore>((set) => ({
  units: {},
  setUnits: (units) => set({ units }),
}));

export function ActiveUnitsQualificationsCard({ canBeOpened = true, unit, children }: Props) {
  const { state, execute } = useFetch();
  const { units, setUnits } = useCacheStore();

  const hoverRef = React.useRef(null);
  const hovered = useHoverDirty(hoverRef);
  const cache = units[unit.id];

  const handleHover = React.useCallback(async () => {
    if (isUnitCombined(unit)) return;
    if (units[unit.id]) return;

    const { json } = await execute(`/leo/qualifications/${unit.id}`, {
      method: "GET",
      noToast: true,
    });

    if (Array.isArray(json)) {
      setUnits({
        ...units,
        [unit.id]: json,
      });
    }
  }, [unit, units, setUnits, execute]);

  React.useEffect(() => {
    if (hovered && state === null) {
      handleHover();
    }
  }, [hovered, state, handleHover]);

  if (isUnitCombined(unit) || !canBeOpened) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return (
    <HoverCard
      openDelay={250}
      showArrow={false}
      contentProps={{ sideOffset: 0, side: "bottom", className: "dark:bg-gray-2" }}
      pointerEvents
      trigger={<span ref={hoverRef}>{children}</span>}
    >
      {state === "loading" ? (
        <Loader />
      ) : (
        <div className="min-w-[450px]">
          <UnitQualificationsTable unit={{ ...unit, qualifications: cache ?? [] }} />
        </div>
      )}
    </HoverCard>
  );
}
