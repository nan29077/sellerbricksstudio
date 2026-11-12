import { PrismaClient } from "@prisma/client"; const db=new PrismaClient();
console.log(await db.$queryRawUnsafe(`select (select count(*) from "StreamChannel" where type::text='CATENOID')::int as cat, (select count(*) from "StreamChannel")::int as total, to_regclass('"CatenoidStreamLog"')::text as logtbl, (select count(*) from information_schema.columns where table_name='LiveSession' and column_name like '%atenoid%' or column_name='selfStreamUrl')::int as cols`));
await db.$disconnect();
