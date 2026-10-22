// The read-only demo trip at app.roundtrip.one/demo: a three-day Kasol
// weekend run by a small Delhi operator. Static and bundled on purpose (a
// real shared demo trip would collect hundreds of strangers as members).
// Dates float: the trip always starts on the Friday after next, so the demo
// reads as an upcoming trip whenever it's opened. Shapes follow the
// `trip-config` value in src/lib/tripConfig.js and the tabs' props.

import { addDays, toISO, softOf } from "../../lib/tripConfig.js";
import { MEMBER_COLORS, DEST_COLORS } from "../../theme.js";

// Friday 5 to 11 days from `today`, as ISO.
export function demoStartISO(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const toFriday = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (toFriday < 5 ? toFriday + 7 : toFriday));
  return toISO(d);
}

export const ORGANISER_ID = "demo-organiser";
export const VIEWER_ID = "demo-you";

export const LEGS = {
  delhi: { name: "Delhi", color: DEST_COLORS[4], soft: softOf(DEST_COLORS[4]), lat: 28.7041, lon: 77.2285, norm: { tempMax: 29, tempMin: 15, precipProb: 5, code: 1 } },
  kasol: { name: "Kasol", color: DEST_COLORS[0], soft: softOf(DEST_COLORS[0]), lat: 32.0099, lon: 77.3152, norm: { tempMax: 19, tempMin: 6, precipProb: 15, code: 2 } },
  tosh: { name: "Tosh", color: DEST_COLORS[2], soft: softOf(DEST_COLORS[2]), lat: 32.0170, lon: 77.4530, norm: { tempMax: 14, tempMin: 2, precipProb: 20, code: 2 } },
};

const DAY_PLANS = [
  {
    leg: "delhi",
    title: "Pickup · overnight to Kasol",
    plan: "8:30 pm: pickup at Majnu ka Tilla, gate 2 (look for the green Parvati Trails sign). 9:00 pm: Volvo leaves. Dinner stop near Murthal around 11:30 pm. Sleep on the bus.",
  },
  {
    leg: "kasol",
    title: "Kasol · Chalal walk",
    plan: "9:30 am: reach Kasol, check in at Riverside Camps. Breakfast. 12:00 pm: easy walk to Chalal across the Parvati bridge (40 min each way). 7:00 pm: bonfire and dinner at camp.",
  },
  {
    leg: "tosh",
    title: "Tosh · back to Delhi",
    plan: "7:30 am: taxi to Barshaini, 45 min hike up to Tosh. Lunch with a view, back down by 2:00 pm. 5:00 pm: Volvo from Kasol. Reach Majnu ka Tilla around 7:00 am Monday.",
  },
];

export const PACKING_TEMPLATE = [
  ["Documents", ["Photo ID (Aadhaar or driving licence)", "Some cash: few ATMs past Bhuntar"]],
  ["Clothes", ["Warm jacket: Tosh drops to 2°C at night", "Thermals", "Woollen cap and gloves", "Trekking shoes with grip"]],
  ["Gear", ["Day backpack", "Water bottle", "Torch or headlamp", "Power bank"]],
  ["Personal", ["Sunscreen and lip balm", "Personal medicines", "Motion-sickness tablets for the hill roads"]],
];

export function buildDemoTrip(today = new Date()) {
  const startDate = demoStartISO(today);
  const days = DAY_PLANS.map((d, i) => ({ date: addDays(startDate, i), ...d }));

  const config = {
    v: 1,
    title: "Kasol weekend",
    startDate,
    endDate: days[days.length - 1].date,
    currency: "INR",
    homeCurrency: null,
    homeRate: null,
    budget: null,
    legs: LEGS,
    legOrder: ["delhi", "kasol", "tosh"],
    days,
    packingTemplate: PACKING_TEMPLATE,
  };

  const members = [
    { user_id: ORGANISER_ID, name: "Rohan (Parvati Trails)", color: MEMBER_COLORS[3], role: "organiser" },
    { user_id: VIEWER_ID, name: "You", color: MEMBER_COLORS[0], role: "member" },
    { user_id: "demo-2", name: "Priya", color: MEMBER_COLORS[1], role: "member" },
    { user_id: "demo-3", name: "Aman", color: MEMBER_COLORS[2], role: "member" },
    { user_id: "demo-4", name: "Sana", color: MEMBER_COLORS[4], role: "member" },
    { user_id: "demo-5", name: "Kabir", color: MEMBER_COLORS[5], role: "member" },
  ];

  // Shared per-day notes from the organiser.
  const overrides = {
    [days[0].date]: { notes: "Bus number and driver's phone will be posted here by 6 pm on the day. Running late? Call Rohan, don't text." },
    [days[2].date]: { notes: "Tosh is cold even at noon. Wear the jacket up, don't pack it in the bus." },
  };

  // The viewer's own list, seeded from the organiser's template, a few ticked.
  let id = 0;
  const mine = PACKING_TEMPLATE.flatMap(([cat, items]) =>
    items.map((text) => ({ id: id++, cat, text, done: false })));
  for (const i of [0, 3, 7]) if (mine[i]) mine[i].done = true;

  const bookings = [
    { id: 1, text: "Volvo seats, both ways: confirmed for all 6", urgent: false, done: true, addedBy: ORGANISER_ID },
    { id: 2, text: "Riverside Camps, Kasol: 3 tents, 1 night", urgent: false, done: true, addedBy: ORGANISER_ID },
    { id: 3, text: "Taxi Kasol to Barshaini on Sunday morning", urgent: true, done: false, addedBy: ORGANISER_ID },
    { id: 4, text: "Balance payment due by Wednesday", urgent: true, done: false, addedBy: ORGANISER_ID },
  ];

  return {
    config,
    members,
    myId: VIEWER_ID,
    overrides,
    packingAll: { [VIEWER_ID]: mine },
    bookings,
  };
}
