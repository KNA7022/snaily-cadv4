import * as React from "react";
import type { GetServerSideProps } from "next";
import { getSessionUser } from "lib/auth";
import { getTranslations } from "lib/getTranslation";
import { FullEmployee, useBusinessState } from "state/businessState";
import type { Business } from "@snailycad/types";
import { Layout } from "components/Layout";
import { Button } from "components/Button";
import { useTranslations } from "use-intl";
import { useModal } from "state/modalState";
import { ModalIds } from "types/ModalIds";
import { BusinessCard } from "components/business/BusinessCard";
import dynamic from "next/dynamic";
import { requestAll } from "lib/utils";
import { Title } from "components/shared/Title";
import { usePermission, Permissions } from "hooks/usePermission";

interface Props {
  businesses: (FullEmployee & { business: Business })[];
  joinableBusinesses: Business[];
}

const CreateBusinessModal = dynamic(
  async () => (await import("components/business/CreateBusinessModal")).CreateBusinessModal,
);

const JoinBusinessModal = dynamic(
  async () => (await import("components/business/JoinBusinessModal")).JoinBusinessModal,
);

export default function BusinessPage(props: Props) {
  const { openModal } = useModal();
  const t = useTranslations("Business");
  const [businesses, setBusinesses] = React.useState(props.businesses);
  const setJoinableBusinesses = useBusinessState((s) => s.setJoinableBusinesses);

  const { hasPermissions } = usePermission();
  const hasCreateBusinessesPerms = hasPermissions([Permissions.CreateBusinesses], true);

  const ownedBusinesses = businesses.filter((em) => em.citizenId === em.business?.citizenId);
  const joinedBusinesses = businesses.filter((em) => em.citizenId !== em.business?.citizenId);

  React.useEffect(() => {
    setJoinableBusinesses(props.joinableBusinesses);
  }, [props.joinableBusinesses, setJoinableBusinesses]);

  return (
    <Layout className="dark:text-white">
      <header className="flex items-center justify-between mb-3">
        <Title className="!mb-0">{t("businesses")}</Title>

        <div>
          <Button onClick={() => openModal(ModalIds.JoinBusiness)}>{t("joinBusiness")}</Button>
          {hasCreateBusinessesPerms ? (
            <Button className="ml-2" onClick={() => openModal(ModalIds.CreateBusiness)}>
              {t("createBusiness")}
            </Button>
          ) : null}
        </div>
      </header>

      <section>
        <h3 className="text-xl font-semibold mb-2">{t("owned")}</h3>
        <ul className="space-y-3">
          {ownedBusinesses.length <= 0 ? (
            <p>{t("noOwned")}</p>
          ) : (
            ownedBusinesses.map((employee) => (
              <BusinessCard key={employee.id} employee={employee} />
            ))
          )}
        </ul>
      </section>

      <section className="mt-3">
        <h3 className="text-xl font-semibold mb-2">{t("joined")}</h3>
        <ul className="space-y-3">
          {joinedBusinesses.length <= 0 ? (
            <p>{t("notEmployee")}</p>
          ) : (
            joinedBusinesses.map((employee) => (
              <BusinessCard key={employee.id} employee={employee} />
            ))
          )}
        </ul>
      </section>

      <JoinBusinessModal onCreate={(bus) => setBusinesses((p) => [...p, bus])} />
      {hasCreateBusinessesPerms ? (
        <CreateBusinessModal onCreate={(employee) => setBusinesses((p) => [...p, employee])} />
      ) : null}
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, req }) => {
  const [data, citizens] = await requestAll(req, [
    ["/businesses", { businesses: [], joinableBusinesses: [] }],
    ["/citizen", []],
  ]);
  return {
    props: {
      businesses: data.businesses,
      joinableBusinesses: data.joinableBusinesses,
      citizens,
      session: await getSessionUser(req),
      messages: {
        ...(await getTranslations(["business", "common"], locale)),
      },
    },
  };
};
