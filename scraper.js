import puppeteer, { executablePath } from "puppeteer";

export async function siteLogin(urlLogin, userEmail, userPassword, page) {
  await page.goto(urlLogin, { waitUntil: "domcontentloaded", timeout: 60000 });

  try {
    await page.waitForSelector("#cookies-consent-essential", {
      visible: true,
      timeout: 5000,
    });
    await page.click("#cookies-consent-essential");
  } catch (_) {}

  await page.waitForSelector("#login", { timeout: 30000 });
  await page.waitForSelector("#password", { timeout: 30000 });

  await page.type("#login", String(userEmail || ""), { delay: 30 });
  await page.type("#password", String(userPassword || ""), { delay: 30 });

  await Promise.all([
    page.click("form button[type='submit']"),
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
  ]);
}
async function getInvitedShifts(page) {
  try {
    await page.waitForSelector("#invitations_table_length", { timeout: 30000 });
  } catch (err) {
    try {
      await page.screenshot({
        path: "/tmp/gb_debug_invited.png",
        fullPage: true,
      });
      const html = await page.content();
      console.error("Invited table not found. HTML head:", html.slice(0, 2000));
    } catch {}
    throw err;
  }

  await page.select("select[name='invitations_table_length']", "100");
  await page.waitForSelector("#invitations_table_info", { timeout: 30000 });

  const hasShifts = await page.$$eval("#invitations_table tbody tr", (rows) => {
    if (!rows.length) return false;
    if (rows.length === 1 && rows[0].querySelector(".dataTables_empty"))
      return false;
    return true;
  });

  if (!hasShifts) return [];

  const rowHandles = await page.$$("#invitations_table tbody tr");
  const invitedShifts = [];

  for (const row of rowHandles) {
    const cells = await row.$$eval("td", (tds) =>
      tds.map((td) => td.innerText.trim())
    );

    const shift = {
      date: cells[0] || "",
      time_from: cells[1] || "",
      time_to: cells[2] || "",
      responsible: cells[3] || "",
      // lunch: false,
      allowed: true,
    };

    try {
      const banIcon = await row.$("i.fa.fa-ban");
      if (banIcon) {
        shift.allowed = false;
      }
      // const takeBtn = await row.$("button.subscribe_shift");
      // if (takeBtn && shift.allowed) {
      //   await takeBtn.click();

      //   await page.waitForSelector("#modal_subscribe", {
      //     visible: true,
      //     timeout: 5000,
      //   });

      //   const lunchInput = await page.$("#lunch_yes");
      //   if (lunchInput) {
      //     const isDisabled = await lunchInput.evaluate((el) =>
      //       el.hasAttribute("disabled")
      //     );
      //     shift.lunch = !isDisabled;
      //   } 

      //   // const closeBtn = await page.$("button.close.dismiss");
      //   // const closeBtn = await page.$("button.btn.btn-secondary.dismiss");
      //   // if (closeBtn) await closeBtn.click();
      //   // console.log("Lunch for:", shift, shift.lunch);
      // }
    } catch (err) {
      console.warn("Could not check for shift:", shift, err);
    }

    invitedShifts.push(shift);
  }

  return invitedShifts;
}

async function getScheduledShifts(page) {
  try {
    await page.waitForSelector("#scheduled_shifts_table_length", {
      timeout: 30000,
    });
  } catch (_) {
    return [];
  }
  await page.select("select[name='scheduled_shifts_table_length']", "100");
  await page.waitForSelector("#scheduled_shifts_table_info", {
    timeout: 30000,
  });

  const hasShifts = await page.$$eval(
    "#scheduled_shifts_table tbody tr",
    (rows) => {
      if (!rows.length) return false;
      if (rows.length === 1 && rows[0].querySelector(".dataTables_empty"))
        return false;
      return true;
    }
  );
  if (!hasShifts) return [];

  const scheduledShifts = await page.$$eval(
    "#scheduled_shifts_table tbody tr",
    (rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll("td");

        // Same structure as invited shifts
        return {
          date: cells[0]?.innerText.trim() || "",
          time_from: cells[1]?.innerText.trim() || "",
          time_to: cells[2]?.innerText.trim() || "",
          responsible: cells[3]?.innerText.trim() || "",
        };
      })
  );
  return scheduledShifts;
}

export async function getShifts(urlLogin, userEmail, userPassword) {
  const browser = await puppeteer.launch({
    headless: "new",
    // headless: false, // show the browser
    // slowMo: 100,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || (await executablePath()),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--window-size=1920,1080",
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(60000);

  try {
    await siteLogin(urlLogin, userEmail, userPassword, page);

    const invitedShifts = await getInvitedShifts(page);
    const scheduledShifts = await getScheduledShifts(page);

    return { invitedShifts, scheduledShifts };
  } finally {
    await browser.close();
  }
}
