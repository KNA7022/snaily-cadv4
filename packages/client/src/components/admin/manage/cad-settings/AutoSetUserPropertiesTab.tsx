import { Form, Formik, FormikHelpers } from "formik";
import { useTranslations } from "use-intl";

import { Button } from "components/Button";
import { FormField } from "components/form/FormField";
import { Loader } from "components/Loader";
import { useAuth } from "context/AuthContext";
import useFetch from "lib/useFetch";
import { FormRow } from "components/form/FormRow";
import type { AutoSetUserProperties } from "@snailycad/types";
import { Toggle } from "components/form/Toggle";
import { SettingsTabs } from "src/pages/admin/manage/cad-settings";
import { TabsContent } from "components/shared/TabList";

export function AutoSetUserPropertiesTab() {
  const common = useTranslations("Common");
  const { state, execute } = useFetch();
  const { cad, setCad } = useAuth();

  async function onSubmit(
    values: typeof INITIAL_VALUES,
    helpers: FormikHelpers<typeof INITIAL_VALUES>,
  ) {
    const { json } = await execute("/admin/manage/cad-settings/auto-set-properties", {
      method: "PUT",
      data: values,
      helpers,
    });

    if (json.id) {
      setCad({ ...cad, ...json });
    }
  }

  const autoSetUserProps = cad?.autoSetUserProperties ?? ({} as AutoSetUserProperties);
  const INITIAL_VALUES = {
    leo: autoSetUserProps.leo ?? false,
    dispatch: autoSetUserProps.dispatch ?? false,
    emsFd: autoSetUserProps.emsFd ?? false,
  };

  return (
    <TabsContent
      aria-label="Auto set user properties"
      value={SettingsTabs.AutoSetProperties}
      className="mt-3"
    >
      <h2 className="text-2xl font-semibold">Auto set user properties</h2>

      <p className="my-3 text-neutral-700 dark:text-gray-200">
        This will automatically set these properties to what value is set below when a user creates
        an account.
        <br />
      </p>

      <p className="text-neutral-700 dark:text-gray-200">
        <b>Warning:</b> It is recommended to only change this if you are sure every user that
        creates an account should get instant access to the set property.
      </p>

      <Formik onSubmit={onSubmit} initialValues={INITIAL_VALUES}>
        {({ handleChange, errors, values }) => (
          <Form className="mt-5 space-y-5">
            <FormRow>
              <FormField errorMessage={errors.leo} label="LEO Access">
                <Toggle name="leo" toggled={values.leo} onClick={handleChange} />
              </FormField>

              <FormField errorMessage={errors.emsFd} label="EMS/FD Access">
                <Toggle name="emsFd" toggled={values.emsFd} onClick={handleChange} />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField errorMessage={errors.dispatch} label="Dispatch Access">
                <Toggle name="dispatch" toggled={values.dispatch} onClick={handleChange} />
              </FormField>
            </FormRow>

            <Button className="flex items-center" type="submit" disabled={state === "loading"}>
              {state === "loading" ? <Loader className="mr-3 border-red-300" /> : null}
              {common("save")}
            </Button>
          </Form>
        )}
      </Formik>
    </TabsContent>
  );
}
