import * as React from "react";
import type { CustomField } from "@snailycad/types";
import { Button } from "components/Button";
import { FormField } from "components/form/FormField";
import { Loader } from "components/Loader";
import { Modal } from "components/modal/Modal";
import { useModal } from "state/modalState";
import { Form, Formik } from "formik";
import useFetch from "lib/useFetch";
import { useTranslations } from "next-intl";
import { ModalIds } from "types/ModalIds";
import { Select } from "components/form/Select";
import { Input } from "components/form/inputs/Input";
import type { NameSearchResult } from "state/search/nameSearchState";
import type { VehicleSearchResult } from "state/search/vehicleSearchState";
import type { WeaponSearchResult } from "state/search/weaponSearchState";
import { CustomFieldResults } from "./CustomFieldResults";
import { handleValidate } from "lib/handleValidate";
import { CUSTOM_FIELD_SEARCH_SCHEMA } from "@snailycad/schemas";

let cache: CustomField[] = [];

export interface CustomFieldResults {
  results: (NameSearchResult | VehicleSearchResult | WeaponSearchResult)[];
  field: CustomField;
}

export function CustomFieldSearch() {
  const { isOpen, closeModal } = useModal();
  const common = useTranslations("Common");
  const t = useTranslations("Leo");
  const { state, execute } = useFetch();
  const [results, setResults] = React.useState<CustomFieldResults | null>(null);
  const [customFields, setCustomFields] = React.useState(cache);

  const fetchOnOpen = React.useCallback(async () => {
    const { json } = await execute("/admin/manage/custom-fields", {});

    if (Array.isArray(json)) {
      cache = json;
      setCustomFields(json);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isOpen(ModalIds.CustomFieldSearch)) {
      fetchOnOpen();
    } else {
      setResults(null);
    }
  }, [fetchOnOpen, isOpen]);

  async function onSubmit(values: typeof INITIAL_VALUES) {
    const { json } = await execute("/search/custom-field", {
      method: "POST",
      data: values,
    });

    if (json.results) {
      setResults(json);
    }
  }

  const validate = handleValidate(CUSTOM_FIELD_SEARCH_SCHEMA);
  const INITIAL_VALUES = {
    query: "",
    customFieldId: null,
  };

  return (
    <Modal
      title={t("customFieldSearch")}
      onClose={() => closeModal(ModalIds.CustomFieldSearch)}
      isOpen={isOpen(ModalIds.CustomFieldSearch)}
      className="w-[850px]"
    >
      <Formik validate={validate} initialValues={INITIAL_VALUES} onSubmit={onSubmit}>
        {({ handleChange, errors, values, isValid }) => (
          <Form>
            <FormField errorMessage={errors.customFieldId} label={t("customField")}>
              <Select
                disabled={state === "loading"}
                onChange={handleChange}
                name="customFieldId"
                value={values.customFieldId}
                values={customFields.map((field) => ({
                  value: field.id,
                  label: field.name,
                }))}
              />
            </FormField>

            <FormField errorMessage={errors.query} label={t("query")}>
              <Input
                disabled={state === "loading"}
                onChange={handleChange}
                name="query"
                value={values.query}
              />
            </FormField>

            {results ? <CustomFieldResults results={results} /> : null}

            <footer className="mt-4 pt-3 flex justify-end">
              <Button
                type="reset"
                onClick={() => closeModal(ModalIds.CustomFieldSearch)}
                variant="cancel"
              >
                {common("cancel")}
              </Button>
              <Button
                className="flex items-center"
                disabled={!isValid || state === "loading"}
                type="submit"
              >
                {state === "loading" ? <Loader className="mr-2" /> : null}
                {common("search")}
              </Button>
            </footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
