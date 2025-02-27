import * as React from "react";
import { Button } from "components/Button";
import { FormField } from "components/form/FormField";
import { Loader } from "components/Loader";
import { Modal } from "components/modal/Modal";
import { useModal } from "state/modalState";
import { Form, Formik, useFormikContext } from "formik";
import useFetch from "lib/useFetch";
import { ModalIds } from "types/ModalIds";
import { useTranslations } from "use-intl";
import { CustomFieldCategory, Citizen, RecordType } from "@snailycad/types";
import { calculateAge, formatCitizenAddress } from "lib/utils";
import format from "date-fns/format";
// import { VehiclesAndWeaponsSection } from "./VehiclesAndWeapons";
import { NameSearchTabsContainer } from "./tabs/TabsContainer";
import { NameSearchResult, useNameSearch } from "state/search/nameSearchState";
import { normalizeValue } from "context/ValuesContext";
import { useRouter } from "next/router";
import { ArrowLeft, PersonFill } from "react-bootstrap-icons";
import { useImageUrl } from "hooks/useImageUrl";
import { useAuth } from "context/AuthContext";
import { useFeatureEnabled } from "hooks/useFeatureEnabled";
import { InputSuggestions } from "components/form/inputs/InputSuggestions";
import { Infofield } from "components/shared/Infofield";
import { CitizenLicenses } from "components/citizen/licenses/LicensesCard";
import { FullDate } from "components/shared/FullDate";
import dynamic from "next/dynamic";
import {
  LicenseInitialValues,
  ManageLicensesModal,
} from "components/citizen/licenses/ManageLicensesModal";
import { ManageCitizenFlagsModal } from "./ManageCitizenFlagsModal";
import { CitizenImageModal } from "components/citizen/modals/CitizenImageModal";
import { ManageCustomFieldsModal } from "./ManageCustomFieldsModal";
import { CustomFieldsArea } from "../CustomFieldsArea";

const VehicleSearchModal = dynamic(
  async () => (await import("components/leo/modals/VehicleSearchModal")).VehicleSearchModal,
);

const WeaponSearchModal = dynamic(
  async () => (await import("components/leo/modals/WeaponSearchModal")).WeaponSearchModal,
);

function AutoSubmit() {
  const { getPayload } = useModal();
  const payloadName = getPayload<Citizen>(ModalIds.NameSearch)?.name;
  const { submitForm } = useFormikContext();

  // if there's a name, auto-submit the form.
  React.useEffect(() => {
    if (payloadName) {
      submitForm();
    }
  }, [payloadName, submitForm]);

  return null;
}

export function NameSearchModal() {
  const { isOpen, closeModal, getPayload } = useModal();
  const common = useTranslations("Common");
  const cT = useTranslations("Citizen");
  const vT = useTranslations("Vehicles");
  const t = useTranslations("Leo");
  const { state, execute } = useFetch();
  const router = useRouter();
  const { makeImageUrl } = useImageUrl();
  const { cad } = useAuth();
  const { SOCIAL_SECURITY_NUMBERS } = useFeatureEnabled();

  const { openModal } = useModal();
  const isLeo = router.pathname === "/officer";
  const { results, currentResult, setCurrentResult, setResults } = useNameSearch();

  const payloadName = getPayload<Citizen>(ModalIds.NameSearch)?.name;

  React.useEffect(() => {
    if (!isOpen(ModalIds.NameSearch)) {
      setResults(null);
      setCurrentResult(null);
    }
  }, [isOpen, setCurrentResult, setResults]);

  async function handleLicensesSubmit(values: LicenseInitialValues) {
    if (!currentResult) return;

    const { json } = await execute(`/search/actions/licenses/${currentResult.id}`, {
      method: "PUT",
      data: {
        ...values,
        driversLicenseCategory: values.driversLicenseCategory.map((v) => v.value),
        pilotLicenseCategory: values.pilotLicenseCategory.map((v) => v.value),
        waterLicenseCategory: values.waterLicenseCategory.map((v) => v.value),
        firearmLicenseCategory: values.firearmLicenseCategory.map((v) => v.value),
      },
    });

    if (json) {
      setCurrentResult({ ...currentResult, ...json });
      closeModal(ModalIds.ManageLicenses);
    }
  }

  async function onSubmit(values: typeof INITIAL_VALUES) {
    const { json } = await execute("/search/name", {
      method: "POST",
      data: values,
    });

    if (Array.isArray(json) && json.length <= 0) {
      setResults(false);
      return;
    }

    const first = Array.isArray(json) ? json[0] : json;

    if (first?.id === currentResult?.id) {
      setCurrentResult(first);
    }

    if (json && typeof json !== "boolean") {
      setResults(Array.isArray(json) ? json : [json]);
    } else {
      setResults(false);
    }
  }

  function handleOpenCreateRecord(type: RecordType) {
    if (!currentResult) return;

    const modalId = {
      [RecordType.ARREST_REPORT]: ModalIds.CreateArrestReport,
      [RecordType.TICKET]: ModalIds.CreateTicket,
      [RecordType.WRITTEN_WARNING]: ModalIds.CreateWrittenWarning,
    };

    openModal(modalId[type], {
      citizenName: `${currentResult.name} ${currentResult.surname}`,
      citizenId: currentResult.id,
    });
  }

  const hasWarrants =
    !currentResult?.isConfidential &&
    (currentResult?.warrants.filter((v) => v.status === "ACTIVE").length ?? 0) > 0;

  const INITIAL_VALUES = {
    name: payloadName ?? "",
  };

  return (
    <Modal
      title={t("nameSearch")}
      onClose={() => closeModal(ModalIds.NameSearch)}
      isOpen={isOpen(ModalIds.NameSearch)}
      className="w-[850px]"
    >
      <Formik initialValues={INITIAL_VALUES} onSubmit={onSubmit}>
        {({ handleChange, setFieldValue, errors, values, isValid }) => (
          <Form>
            <FormField errorMessage={errors.name} label={cT("fullName")}>
              <InputSuggestions
                onSuggestionClick={(suggestion: NameSearchResult) => {
                  setFieldValue("name", `${suggestion.name} ${suggestion.surname}`);
                  setCurrentResult(suggestion);
                }}
                Component={({ suggestion }: { suggestion: Citizen }) => (
                  <div className="flex items-center">
                    {suggestion.imageId ? (
                      <img
                        className="rounded-md w-[30px] h-[30px] object-cover mr-2"
                        draggable={false}
                        src={makeImageUrl("citizens", suggestion.imageId)}
                      />
                    ) : null}
                    <p>
                      {suggestion.name} {suggestion.surname}{" "}
                      {SOCIAL_SECURITY_NUMBERS && suggestion.socialSecurityNumber ? (
                        <>(SSN: {suggestion.socialSecurityNumber})</>
                      ) : null}
                    </p>
                  </div>
                )}
                options={{
                  apiPath: "/search/name",
                  method: "POST",
                  dataKey: "name",
                }}
                inputProps={{
                  value: values.name,
                  name: "name",
                  onChange: handleChange,
                }}
              />
            </FormField>

            {typeof results === "boolean" ? <p>{t("nameNotFound")}</p> : null}

            {Array.isArray(results) && !currentResult ? (
              <ul className="space-y-2">
                {results.map((result) => (
                  <li className="flex items-center justify-between" key={result.id}>
                    <div className="flex items-center">
                      <div className="mr-2 min-w-[50px]">
                        {result.imageId ? (
                          <img
                            className="rounded-md w-[50px] h-[50px] object-cover"
                            draggable={false}
                            src={makeImageUrl("citizens", result.imageId)}
                          />
                        ) : (
                          <PersonFill className="text-gray-500/60 w-[50px] h-[50px]" />
                        )}
                      </div>
                      <p>
                        {result.name} {result.surname}{" "}
                        {SOCIAL_SECURITY_NUMBERS && result.socialSecurityNumber ? (
                          <>(SSN: {result.socialSecurityNumber})</>
                        ) : null}
                      </p>
                    </div>

                    <Button type="button" onClick={() => setCurrentResult(result)}>
                      {common("view")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {typeof results !== "boolean" && currentResult ? (
              currentResult.isConfidential ? (
                <p className="my-5 px-2">{t("citizenIsConfidential")}</p>
              ) : (
                <div className="mt-3">
                  <header className="flex justify-between mb-5">
                    <h3 className="text-2xl font-semibold">{t("results")}</h3>

                    <div>
                      <Button
                        className="flex items-center justify-between gap-2"
                        type="button"
                        onClick={() => setCurrentResult(null)}
                      >
                        <ArrowLeft />
                        {t("viewAllResults")}
                      </Button>
                    </div>
                  </header>

                  {currentResult?.dead && currentResult?.dateOfDead ? (
                    <div className="p-2 mt-2 font-semibold text-black rounded-md bg-amber-500">
                      {t("citizenDead", {
                        date: format(
                          new Date(currentResult.dateOfDead ?? new Date()),
                          "MMMM do yyyy",
                        ),
                      })}
                    </div>
                  ) : null}

                  {hasWarrants ? (
                    <div className="p-2 my-2 font-semibold bg-red-700 rounded-md">
                      {t("hasWarrants")}
                    </div>
                  ) : null}

                  <div className="flex">
                    <div className="mr-2 min-w-[100px]">
                      {currentResult.imageId ? (
                        <button
                          type="button"
                          onClick={() => openModal(ModalIds.CitizenImage)}
                          className="cursor-pointer"
                        >
                          <img
                            className="rounded-md w-[100px] h-[100px] object-cover"
                            draggable={false}
                            src={makeImageUrl("citizens", currentResult.imageId)}
                          />
                        </button>
                      ) : (
                        <PersonFill className="text-gray-500/60 w-[100px] h-[100px]" />
                      )}
                    </div>
                    <div className="w-full">
                      <div className="flex flex-col">
                        <Infofield label={cT("fullName")}>
                          {currentResult.name} {currentResult.surname}
                        </Infofield>

                        {SOCIAL_SECURITY_NUMBERS && currentResult.socialSecurityNumber ? (
                          <Infofield label={cT("socialSecurityNumber")}>
                            {currentResult.socialSecurityNumber}
                          </Infofield>
                        ) : null}

                        <Infofield label={cT("dateOfBirth")}>
                          <FullDate isDateOfBirth onlyDate>
                            {currentResult.dateOfBirth}
                          </FullDate>{" "}
                          ({cT("age")}: {calculateAge(currentResult.dateOfBirth)})
                        </Infofield>

                        <Infofield label={cT("gender")}>{currentResult.gender.value}</Infofield>
                        <Infofield label={cT("ethnicity")}>
                          {currentResult.ethnicity.value}
                        </Infofield>
                        <Infofield label={cT("hairColor")}>{currentResult.hairColor}</Infofield>
                        <Infofield label={cT("eyeColor")}>{currentResult.eyeColor}</Infofield>
                      </div>

                      <div className="flex flex-col">
                        <Infofield label={cT("weight")}>
                          {currentResult.weight} {cad?.miscCadSettings?.weightPrefix}
                        </Infofield>

                        <Infofield label={cT("height")}>
                          {currentResult.height} {cad?.miscCadSettings?.heightPrefix}
                        </Infofield>

                        <Infofield label={cT("address")}>
                          {formatCitizenAddress(currentResult)}
                        </Infofield>

                        <Infofield label={cT("phoneNumber")}>
                          {currentResult.phoneNumber || common("none")}
                        </Infofield>

                        <Infofield className="max-w-[400px]" label={cT("occupation")}>
                          {currentResult.occupation || common("none")}
                        </Infofield>
                      </div>
                    </div>

                    <div className="w-full">
                      <div>
                        <ul className="flex flex-col">
                          <CitizenLicenses citizen={currentResult} />
                        </ul>

                        {isLeo ? (
                          <Button
                            small
                            type="button"
                            className="mt-2"
                            onClick={() => openModal(ModalIds.ManageLicenses)}
                          >
                            {t("editLicenses")}
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <Infofield label={vT("flags")}>
                          {currentResult.flags?.map((v) => v.value).join(", ") || common("none")}
                        </Infofield>

                        {isLeo ? (
                          <Button
                            small
                            type="button"
                            className="mt-2"
                            onClick={() => openModal(ModalIds.ManageCitizenFlags)}
                          >
                            {t("manageCitizenFlags")}
                          </Button>
                        ) : null}
                      </div>

                      <CustomFieldsArea currentResult={currentResult} isLeo={isLeo} />
                    </div>
                  </div>

                  <div className="mt-5">
                    <NameSearchTabsContainer />
                  </div>
                </div>
              )
            ) : null}

            <footer
              className={`mt-4 pt-3 flex ${
                currentResult && isLeo ? "justify-between" : "justify-end"
              }`}
            >
              {currentResult && isLeo ? (
                <div>
                  {Object.values(RecordType).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      onClick={() => handleOpenCreateRecord(type)}
                      variant="cancel"
                      className="px-1.5"
                    >
                      {t(normalizeValue(`CREATE_${type}`))}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="flex">
                <Button
                  type="reset"
                  onClick={() => closeModal(ModalIds.NameSearch)}
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
              </div>
            </footer>

            <AutoSubmit />
            <VehicleSearchModal id={ModalIds.VehicleSearchWithinName} />
            <WeaponSearchModal id={ModalIds.WeaponSearchWithinName} />
            {currentResult && !currentResult.isConfidential ? (
              <>
                <ManageCitizenFlagsModal />
                <ManageCustomFieldsModal
                  category={CustomFieldCategory.CITIZEN}
                  url={`/search/actions/custom-fields/citizen/${currentResult.id}`}
                  allCustomFields={currentResult.allCustomFields ?? []}
                  customFields={currentResult.customFields ?? []}
                  onUpdate={(results) => setCurrentResult({ ...currentResult, ...results })}
                />
                <ManageLicensesModal
                  allowRemoval={false}
                  state={state}
                  onSubmit={handleLicensesSubmit}
                  citizen={currentResult}
                />
                <CitizenImageModal citizen={currentResult} />
              </>
            ) : null}
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
