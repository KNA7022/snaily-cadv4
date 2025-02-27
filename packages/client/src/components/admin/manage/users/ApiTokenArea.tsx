import type { User } from "@snailycad/types";
import { FullDate } from "components/shared/FullDate";
import { Infofield } from "components/shared/Infofield";
import { Table } from "components/shared/Table";

interface Props {
  user: User;
}

export function ApiTokenArea({ user }: Props) {
  return (
    <div className="p-4 mt-10 bg-gray-200 rounded-md dark:bg-gray-2">
      <h1 className="text-2xl font-semibold">API Token</h1>

      {user.apiToken ? (
        <div className="mt-2">
          <Infofield label="Uses">{String(user.apiToken.uses ?? 0)}</Infofield>
          <Infofield label="Created At">
            <FullDate>{user.apiToken.createdAt}</FullDate>
          </Infofield>

          {!user.apiToken.logs?.length ? null : (
            <Table
              data={user.apiToken.logs.map((log) => ({
                route: (
                  <span className="font-mono">
                    <span className="font-semibold">{log.method}</span> {log.route}
                  </span>
                ),
                createdAt: <FullDate>{log.createdAt}</FullDate>,
              }))}
              columns={[
                { Header: "Route", accessor: "route" },
                { Header: "Created At", accessor: "createdAt" },
              ]}
            />
          )}
        </div>
      ) : (
        <p className="text-neutral-700 dark:text-gray-400 mt-2">User has no API Token set.</p>
      )}
    </div>
  );
}
