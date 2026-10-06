// Creates a business (if needed) and its first ADMIN user, prompting for the
// password so it never appears in shell history, code or the repo.
// Usage: npm run create-admin
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";

const db = new PrismaClient();

// Echo goes through this stream so it can be muted while typing the password.
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, { hidden = false } = {}) {
  stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) stdout.write("\n");
  return String(value ?? "").trim();
}

async function main() {
  const businessName = await ask("Nombre del negocio: ");
  const name = await ask("Nombre del administrador: ");
  const email = (await ask("Email del administrador: ")).toLowerCase();
  const password = await ask("Contraseña (mín. 10 caracteres): ", { hidden: true });

  if (!businessName || !name || !email) throw new Error("Todos los campos son obligatorios");
  if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
  if (await db.user.findUnique({ where: { email } })) throw new Error("Ya existe un usuario con ese email");

  const business =
    (await db.business.findFirst({ where: { name: businessName } })) ??
    (await db.business.create({ data: { name: businessName } }));

  await db.user.create({
    data: {
      businessId: business.id,
      name,
      email,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`Administrador ${email} creado para "${business.name}".`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await db.$disconnect();
  });
