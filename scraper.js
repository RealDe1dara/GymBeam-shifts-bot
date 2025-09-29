import puppeteer from "puppeteer";

export async function siteLogin(urlLogin, userEmail, userPassword, page) {
  await page.goto(urlLogin, { waitUntil: "load" });
  await page.waitForSelector("#cookies-consent-essential", { visible: true });
  await page.click("#cookies-consent-essential");

  await page.waitForSelector("#login");
  await page.waitForSelector("#password");

  await page.type("#login", userEmail, { delay: 50 });
  await page.type("#password", userPassword, { delay: 50 });

  await Promise.all([
    page.click("form button[type='submit']"),
    page.waitForNavigation({ waitUntil: "load" }),
  ]);
}

async function getInvitedShifts(page) {
  await page.waitForSelector("#invitations_table_length");
  await page.select("select[name='invitations_table_length']", "100");

  await page.waitForSelector("#invitations_table_info");

  const hasShifts = await page.$$eval("#invitations_table tbody tr", (rows) => {
    if (!rows.length) return false;

    if (rows.length === 1 && rows[0].querySelector(".dataTables_empty")) {
      return false;
    }
    return true;
  });

  if (!hasShifts) {
    return [];
  }

  const invitedShifts = await page.$$eval(
    "#invitations_table tbody tr",
    (rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          date: cells[0]?.innerText.trim(),
          time_from: cells[1]?.innerText.trim(),
          time_to: cells[2]?.innerText.trim(),
          responsible: cells[3]?.innerText.trim(),
        };
      })
  );
  return invitedShifts;
}

async function getScheduledShifts(page) {
  await page.waitForSelector("#scheduled_shifts_table_length");
  await page.select("select[name='scheduled_shifts_table_length']", "100");

  await page.waitForSelector("#scheduled_shifts_table_info");

  const hasShifts = await page.$$eval(
    "#scheduled_shifts_table tbody tr",
    (rows) => {
      if (!rows.length) return false;

      if (rows.length === 1 && rows[0].querySelector(".dataTables_empty")) {
        return false;
      }
      return true;
    }
  );

  if (!hasShifts) {
    return [];
  }

  const scheduledShifts = await page.$$eval(
    "#scheduled_shifts_table tbody tr",
    (rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          date: cells[0]?.innerText.trim(),
          time_from: cells[1]?.innerText.trim(),
          time_to: cells[2]?.innerText.trim(),
          responsible: cells[3]?.innerText.trim(),
        };
      })
  );
  return scheduledShifts;
}

export async function getShifts(urlLogin, userEmail, userPassword) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await siteLogin(urlLogin, userEmail, userPassword, page);

  const invitedShifts = await getInvitedShifts(page);
  const scheduledShifts = await getScheduledShifts(page);
  await browser.close();

  return {
    invitedShifts,
    scheduledShifts,
  };
}
