import * as React from "react";
import type { Full911Call } from "state/dispatchState";
import type { FormikHelpers } from "formik";
import compareDesc from "date-fns/compareDesc";
import useFetch from "lib/useFetch";
import { useTranslations } from "use-intl";
import type { Call911Event } from "@snailycad/types";
import { EventItem } from "../events/EventItem";
import { UpdateEventForm } from "../events/UpdateEventForm";

interface Props {
  call: Full911Call;
  disabled?: boolean;
  onUpdate?(event: Full911Call): void;
  onCreate?(event: Full911Call): void;
}

export function CallEventsArea({ disabled, call, onUpdate, onCreate }: Props) {
  const { state, execute } = useFetch();
  const common = useTranslations("Common");
  const t = useTranslations("Calls");
  const [tempEvent, setTempEvent] = React.useState<Call911Event | null>(null);

  async function onEventSubmit(
    values: { description: string },
    helpers: FormikHelpers<{ description: string }>,
  ) {
    if (!call) return;

    if (tempEvent) {
      const { json } = await execute(`/911-calls/events/${call.id}/${tempEvent.id}`, {
        method: "PUT",
        data: values,
      });

      if (json.id) {
        onUpdate?.(json);
      }
    } else {
      const { json } = await execute(`/911-calls/events/${call.id}`, {
        method: "POST",
        data: values,
      });

      if (json.id) {
        onCreate?.(json);
      }
    }

    setTempEvent(null);
    helpers.resetForm();
  }

  return (
    <div className="md:w-[45rem] w-full mt-5 md:mt-0 md:ml-3 relative">
      <h4 className="text-xl font-semibold">{common("events")}</h4>

      <ul className="overflow-auto max-h-[350px] md:max-h-[65%] md:h-[65%]">
        {(call?.events.length ?? 0) <= 0 ? (
          <p className="mt-2">{t("noEvents")}</p>
        ) : (
          call?.events
            .sort((a, b) => compareDesc(new Date(a.createdAt), new Date(b.createdAt)))
            .map((event) => (
              <EventItem
                disabled={disabled}
                key={event.id}
                setTempEvent={setTempEvent}
                event={event}
                isEditing={tempEvent?.id === event.id}
              />
            ))
        )}
      </ul>

      {disabled ? null : (
        <UpdateEventForm
          onSubmit={onEventSubmit}
          state={state}
          event={tempEvent}
          setEvent={setTempEvent}
        />
      )}
    </div>
  );
}
