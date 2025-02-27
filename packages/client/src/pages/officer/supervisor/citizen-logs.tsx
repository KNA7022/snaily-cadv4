import * as React from "react";
import { useTranslations } from "use-intl";
import { Layout } from "components/Layout";
import { getSessionUser } from "lib/auth";
import { getTranslations } from "lib/getTranslation";
import { requestAll } from "lib/utils";
import type { GetServerSideProps } from "next";
import type { Citizen, RecordLog } from "@snailycad/types";
import { FormField } from "components/form/FormField";
import { Input } from "components/form/inputs/Input";
import { Title } from "components/shared/Title";
import { Permissions } from "@snailycad/permissions";
import { TabList } from "components/shared/TabList";
import { CitizenLogsTab } from "components/leo/citizen-logs/CitizenLogsTab";
import { ArrestReportsTab } from "components/leo/citizen-logs/ArrestReportsTab";
import { useFeatureEnabled } from "hooks/useFeatureEnabled";

export type CitizenLog = RecordLog & { citizen: Citizen };
interface Props {
  logs: CitizenLog[];
}

export default function CitizenLogs({ logs }: Props) {
  const [search, setSearch] = React.useState("");
  const { CITIZEN_RECORD_APPROVAL } = useFeatureEnabled();

  const t = useTranslations("Leo");
  const common = useTranslations("Common");

  const TABS = [{ value: "citizen-logs-tab", name: t("citizenLogs") }];

  if (CITIZEN_RECORD_APPROVAL) {
    TABS[1] = { value: "arrest-reports-tab", name: t("arrestReportLogs") };
  }

  return (
    <Layout
      permissions={{ fallback: (u) => u.isLeo, permissions: [Permissions.ViewCitizenLogs] }}
      className="dark:text-white"
    >
      <Title>{t("citizenLogs")}</Title>

      <FormField label={common("search")} className="my-2">
        <Input onChange={(e) => setSearch(e.target.value)} value={search} />
      </FormField>

      <TabList tabs={TABS}>
        <CitizenLogsTab search={search} logs={logs} />
        {CITIZEN_RECORD_APPROVAL ? <ArrestReportsTab search={search} logs={logs} /> : null}
      </TabList>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, locale }) => {
  const [logs] = await requestAll(req, [["/admin/manage/citizens/records-logs", []]]);

  return {
    props: {
      session: await getSessionUser(req),
      logs,
      messages: {
        ...(await getTranslations(["leo", "common"], locale)),
      },
    },
  };
};
