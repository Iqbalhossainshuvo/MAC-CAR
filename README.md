# MAC CAR — Fleet Command 🚗⚡

গাড়ি, ড্রাইভার, ইনকাম, খরচ ও রিপোর্ট ম্যানেজ করার ওয়েব অ্যাপ।
**সব ডাটা থাকে Admin-এর নিজের Google Sheet-এ।** অ্যাপটি মোবাইলে (iPhone ও Android) অ্যাপের মতো ইনস্টল করা যায়। একই কোড দিয়ে পরে App Store / Play Store-এর অ্যাপও বানানো যাবে।

ডিজাইন: হালকা ল্যাভেন্ডার ব্যাকগ্রাউন্ড, সাদা গ্লাস কার্ড, পার্পল গ্রেডিয়েন্ট (soft UI / glassmorphism)।

---

## কী কী আছে

| মেনু | কাজ |
|---|---|
| **Dashboard** | মোট গাড়ি, ড্রাইভার, ইনকাম, খরচ, নিট লাভ; কোন গাড়ি কত লাভ; গত ৬ মাস; ৩০ দিনের মধ্যে কোন ডকুমেন্ট/লাইসেন্স/ইকামার মেয়াদ শেষ; ড্রাইভারের এন্ট্রি অনুমোদন; এখন কে কোন গাড়ি চালাচ্ছে |
| **Car** | সব গাড়ির লিস্ট, প্রতিটির ডকুমেন্ট ও মেয়াদ শেষের তারিখ (লাল = শেষ, হলুদ = শীঘ্রই), এখনকার ড্রাইভার, লাভ। **Details** বাটনে গাড়ির A–Z তথ্য: ডকুমেন্ট, কোন ড্রাইভার কবে থেকে কবে পর্যন্ত চালিয়েছে, ইনকাম, খরচ, ডেইলি রিপোর্ট, প্রিন্ট |
| **Driver** | ড্রাইভার লিস্ট: এখন কোন গাড়ি, কবে থেকে, কাজে কত টাকা দিয়েছে, জরিমানা কত। 👁 আইকনে সব ডিটেইলস: প্রোফাইল, গাড়ির ইতিহাস, কাজ/খরচ, জরিমানা, ডেইলি রিপোর্ট |
| **Salary** | সব ড্রাইভারের বেতন হিসাব এক পেজে; এক ক্লিকে সবার মাসের বেতন যোগ; কোম্পানি কত পাবে / দেবে |
| **Income** | গাড়ি কাকে কত টাকায় দেওয়া হয়েছে, খরচ কত, মোট ইনকাম ও নিট; বাকি (due) টাকা |
| **Expense** | সব খরচ (ফুয়েল, মেরামত, সার্ভিস, জরিমানা…), ড্রাইভারের পাঠানো এন্ট্রি Approve/Reject |
| **Report** | গাড়ির নাম/নাম্বার, ড্রাইভার, তারিখ, ক্যাটাগরি দিয়ে ফিল্টার করে সব তথ্য দেখা এবং **Print / Save PDF** |
| **Archive** | ডিলিট করা সব কিছু এখানে থাকে; Restore করে ফেরত আনা যায় |
| **User** | Admin ড্রাইভারের লগিন (username + password) তৈরি করেন, পাসওয়ার্ড রিসেট করেন, অ্যাকাউন্ট চালু/বন্ধ করেন |


### ড্রাইভারের বেতন ও হিসাব (Salary account)

প্রত্যেক ড্রাইভারের একটা চলমান হিসাব (ব্যাংক স্টেটমেন্টের মতো)। ব্যালেন্স + হলে কোম্পানি ড্রাইভারকে দেবে, − হলে ড্রাইভার কোম্পানিকে দেবে (বেশি নিয়ে ফেললে পরের মাসে নিজে থেকে চলে যায়)।

| এন্ট্রি | হিসাবে প্রভাব |
|---|---|
| মাসিক বেতন (Salary) | + |
| ইনসেন্টিভ / বোনাস | + |
| ড্রাইভার নিজের টাকায় খরচ করেছে (অনুমোদিত) | + |
| ড্রাইভার টাকা ফেরত দিয়েছে | + |
| ক্যাশ অ্যাডভান্স | − |
| জরিমানা (কোম্পানি দিয়েছে, ড্রাইভারের কাছ থেকে কাটা হবে) | − — Admin চাইলে "Waive" করে মাফ করতে পারেন |
| অন্য কাটা (Deduction) | − |
| বেতন পরিশোধ (Salary paid) | − |

- একই মাসের বেতন দুবার যোগ করা যায় না; সব হিসাব হালালা পর্যন্ত নির্ভুল (পূর্ণসংখ্যায় হিসাব)।
- ড্রাইভার জরিমানা জমা না দিলে Admin নিজে "Add fine" দিয়ে যোগ করতে পারেন; ড্রাইভারের প্রোফাইলে দেখা যাবে।
- ড্রাইভার Profile → **My salary**-তে নিজের মাস-ভিত্তিক হিসাব দেখতে পান।
- Dashboard-এর নিট লাভ = ইনকাম − গাড়ির খরচ − ড্রাইভারের বেতন (জরিমানা কেটে)।

### বেতনের কাঠামো, বকেয়া ও বেতনের সময়
- Driver → Edit driver (বা User → Edit)-এ **Basic salary, Food, Accommodation, Transport, Other allowance** আলাদা দিন। মোট মাসিক বেতন নিজে থেকে যোগ হয়।
- ড্রাইভার তার Home ও Profile-এ এই কাঠামো এবং "Company owes you now" দেখেন।
- প্রতি মাসের **২৫ তারিখ থেকে পরের মাসের ৫ তারিখ** পর্যন্ত Admin-এর Dashboard ও Salary পেজে **Salary time** কার্ড আসে: কার বেতন যোগ হয়নি, কাকে কত দিতে হবে।
- কম টাকা দিলে বাকিটা পরের মাসে যোগ হয়ে মোট দেখায়, নিচে ছোট করে লেখা থাকে: "Includes unpaid from September 2026 (SAR 500)"। টাকা দিলে আগে পুরনো মাসের বকেয়া শোধ হয়।

### গাড়ির কাজের জন্য কোম্পানির টাকা (Company cash)
- Driver পেজে **Company cash for car work** → **Give cash** দিয়ে ড্রাইভারকে টাকা দিন। এটা বেতন থেকে আলাদা থাকে।
- ড্রাইভার খরচ দেওয়ার সময় "Paid from" বাছাই করেন: **Company cash I hold / My own money / Company paid directly**। কোম্পানির টাকা হাতে থাকলে নিজে থেকেই **Company cash** বাছাই থাকে; কিছু না বাছালেও সার্ভার সেটাই ধরে।
- Company cash থেকে খরচ হলে ব্যালেন্স কমে; বেশি খরচ করলে ব্যালেন্স মাইনাস = কোম্পানি তাকে দেবে।
- **Returned** (বাকি টাকা ফেরত), **Take from salary** (টাকা রেখে দিলে বেতন থেকে কাটা) বা **Add to salary** (বেশি খরচ বেতনে যোগ) — এক চাপে হিসাব শূন্য।
- Company cash দিয়ে জরিমানা দিলে, approve হলে বেতন থেকে কাটা যায় (মাফ করা যায়)।

### ভাড়ার গাড়ি ও শেয়ারের গাড়ি, Partner
- গাড়ি Add/Edit-এ **Ownership**: Company car / **Rented from someone** (মালিক, ফোন, মাসিক ভাড়া, সময়) / **Shared with partners**।
- ভাড়ার গাড়ির পেজে এই মাসের ভাড়া যোগ হয়েছে কিনা দেখায়, এক চাপে "Car rent" খরচ যোগ হয়। লাভ ভাড়া বাদ দিয়ে দেখায়।
- User → Add user → Role **Partner (share holder)**। তারপর শেয়ারের গাড়ির পেজে **Partners → Add**: Partner, **Share %**, **Company management fee %** (ঐচ্ছিক), তারিখ। এক গাড়িতে মোট ১০০%-এর বেশি দেওয়া যায় না।
- প্রতি মাসে: গাড়ির লাভ = আয় − approved খরচ। Fee বাদে Partner পান তার %। গাড়ির পেজে মাসওয়ারি ভাগ (Partner কত, কোম্পানি কত)।
- **Partners** মেনু: সবার Wallet। Partner পেজে **Pay partner** (দিলে Wallet কমে, পুরো দিলে 0), Add/Take (সংশোধন)। বাকি থাকলে পরের মাসে যোগ হয়ে দেখায়, নিচে লেখা থাকে কোন মাসের কত।
- Partner লগিন করলে শুধু তার গাড়ির আয়-খরচ, লাভ-লস ও Wallet দেখেন; ড্রাইভারের তথ্য দেখেন না।
- Dashboard-এর কোম্পানির Net profit থেকে Partner-দের ভাগ বাদ দেওয়া হয়।

### প্রতিদিনের রিপোর্ট WhatsApp-এ (অটোমেটিক)
Admin → **Settings**: নাম্বারগুলো, সময়, কী কী যাবে (Summary, Daily reports, রিপোর্ট না দেওয়া গাড়ি, খরচ, আয়, Approve বাকি, ডকুমেন্টের মেয়াদ, Company cash, বেতন), **PDF বা Picture** বাছাই করে Save। **Send report now** দিয়ে পরীক্ষা করুন।
এটা Meta-র অফিসিয়াল **WhatsApp Business Cloud API** দিয়ে যায়, একবার সেটআপ লাগে (Settings পেজের নিচে ধাপগুলো লেখা আছে):
1. developers.facebook.com → Create app (Business) → WhatsApp যোগ করুন, কোম্পানির নাম্বার যোগ ও verify করুন → **Phone number ID** কপি।
2. Business Settings → System users → Admin user → token তৈরি (whatsapp_business_messaging, whatsapp_business_management) → **Access token** কপি।
3. WhatsApp Manager → Message templates → Utility template (যেমন `daily_report`), Header = Document (Picture হলে Image), Body-তে একটা ভ্যারিয়েবল `{{1}}` → approve হওয়া পর্যন্ত অপেক্ষা।
4. Settings-এ token, Phone number ID, template নাম দিন। Template ছাড়া মেসেজ শুধু তখনই যায় যদি ঐ নাম্বার গত ২৪ ঘণ্টায় কোম্পানির নাম্বারে মেসেজ দিয়ে থাকে।
> Picture অপশনে রিপোর্টের সারাংশ টেবিল ছবি হিসেবে যায়; ছবি তৈরি না হলে নিজে থেকে PDF পাঠায় এবং Settings-এ তা লেখা থাকে।

### নিজের প্রোফাইল (সবার জন্য) — শুধু আপডেট, ডিলিট নয়
- Driver (Profile ট্যাব), Partner (Home-এর নিচে), Admin/Manager (মেনু → **My profile**) নিজের প্রোফাইল তৈরি ও আপডেট করতে পারেন: নাম, ফোন, জাতীয়তা, জন্মতারিখ, ঠিকানা, জরুরি যোগাযোগ, ইকামা, লাইসেন্স (ড্রাইভার), ব্যাংক ও IBAN।
- একবার পূরণ করা ঘর **মোছা যায় না**, শুধু বদলানো যায় (সার্ভারেও আটকানো)। Role, বেতন, username ইত্যাদি শুধু Admin বদলাতে পারেন।
- ড্রাইভার নিজের ডকুমেন্ট (ইকামা, লাইসেন্স, পাসপোর্ট) যোগ, আপডেট ও ছবি/ফাইল বদলাতে পারেন — মুছতে পারেন না।
- ড্রাইভার কিছুই ডিলিট করতে পারেন না: Approve হওয়ার আগে নিজের খরচ, আর আজকের ডেইলি রিপোর্ট **Edit** করে ঠিক করতে পারেন। Manager-এর মোছার (Archive) অনুমতি Admin যা দিয়েছেন তা-ই থাকে।

### ডকুমেন্ট ফাইল

প্রতিটি ডকুমেন্টে (গাড়ির Istimara/Insurance/Fahas বা ড্রাইভারের Iqama/License/Passport) ফাইল **আপলোড, ক্যামেরায় ছবি, দেখা, ডাউনলোড, বদলানো ও মুছা** যায়। ফাইল Admin-এর Google Drive-এর **MAC CAR Files** ফোল্ডারে থাকে (সর্বোচ্চ ১০ MB, PDF বা ছবি)।

### খরচের রসিদ (Receipt / ফাতুরা)

প্রতিটি খরচে রসিদের ছবি বা PDF লাগানো যায়: ড্রাইভার খরচ যোগ করার সময়ই "Choose file / Take photo" দিয়ে, অথবা পরে History থেকে। Admin সেটা দেখতে ও ডাউনলোড করতে পারেন। খরচে ড্রাইভারের নামও দেখায় — "Paid by Karim Uddin" (ড্রাইভার নিজে দিয়েছে) বা "Via Karim Uddin" (কোম্পানি দিয়েছে, ড্রাইভারের মাধ্যমে)।

### কিছুই মুছে যায় না (Archive)

Delete চাপলে জিনিসটা **Archive**-এ চলে যায়: অ্যাপের সব জায়গা থেকে লুকানো থাকে এবং হিসাবে ধরা হয় না, কিন্তু Google Sheet-এ থেকে যায় (`archived` কলামে TRUE)। Admin মেনু → **Archive** থেকে যেকোনো সময় **Restore** করা যায়। Google Drive-এর ফাইলও মোছা হয় না — বদলালে পুরোনোটার নামের আগে `[replaced]` লেখা থাকে।

### দ্রুত ও অফলাইন

ডাটা ফোনে/ব্রাউজারে একটা কপি হিসেবে থাকে, তাই অ্যাপ সাথে সাথে খোলে। সেভ করলে সাথে সাথে স্ক্রিনে দেখায় এবং পেছনে Google Sheet-এ যায় (উপরে "Saving…")। ইন্টারনেট না থাকলে "Offline" দেখায়, এন্ট্রিগুলো অপেক্ষা করে এবং নেট এলে নিজে থেকে সেভ হয়।

### Manager (Admin-এর সহযোগী)
User → Add user → Role: **Manager (admin assistant)** বাছাই করলে নিচে একটা লিস্ট আসে, সেখানে টিক দিয়ে ঠিক করে দিন এই ব্যক্তি কী কী পাবেন:

| অংশ | No access / View only / View & edit |
|---|---|
| Cars | গাড়ি, গাড়ির ডকুমেন্ট, কোন ড্রাইভার কোন গাড়ি |
| Drivers | ড্রাইভারের তথ্য, ড্রাইভারের ডকুমেন্ট, ডেইলি রিপোর্ট |
| Expenses | খরচ ও রসিদ |
| Income | ইনকাম |
| Salary | বেতন, অ্যাডভান্স, ইনসেন্টিভ, পেমেন্ট |

আলাদা অনুমতি (টিক): **Approve expenses** (Approve/Reject ও জরিমানা মাফ), **Driver logins** (ড্রাইভারের লগিন তৈরি, পাসওয়ার্ড রিসেট, Active/Inactive), **Reports & profit** (রিপোর্ট ও লাভ-ক্ষতি), **Archive** (মুছে ফেলা জিনিস দেখা ও Restore)।

Manager যেটা পাননি সেটা মেনুতেই দেখবেন না, আর সার্ভারও (Apps Script) সেটা আটকে দেয়। Approve অনুমতি না থাকলে Manager-এর দেওয়া খরচ "pending" হয়ে থাকে, Admin approve করলে হিসাবে যোগ হয়। Manager কখনো Admin বা অন্য Manager-এর অ্যাকাউন্ট বদলাতে বা কাউকে বেশি অনুমতি দিতে পারেন না। অনুমতি পরে বদলাতে চাইলে User → Edit।

**Admin** সব দেখতে ও করতে পারেন। **Driver** লগিন করে শুধু নিজের প্রোফাইল ও গাড়ি দেখেন, প্রতিদিনের কাজের রিপোর্ট এবং খরচ/জরিমানা পাঠান। Admin সেগুলো দেখে Approve করেন। ড্রাইভার ইনকাম বা অন্য কারও তথ্য দেখতে পারেন না; এই নিয়ম সার্ভারেই (Apps Script) চেক হয়।

---

### টাকার হিসাব যাচাই
`npm run test:money` হাজার হাজার এলোমেলো হিসাব (বেতন, Company cash, Partner ভাগ, বকেয়া) বানিয়ে প্রতিটা যোগফল আলাদাভাবে মিলিয়ে দেখে। `node apps-script/test/test.js apps-script/Code.gs` সার্ভারের নিয়ম পরীক্ষা করে।

## কীভাবে কাজ করে

```
📱 ওয়েব অ্যাপ (Expo / React Native Web)
        │  HTTPS
        ▼
⚙️ Google Apps Script (apps-script/Code.gs)  ← লগিন, পারমিশন চেক
        │
        ▼
📊 Google Sheet (Admin-এর Google Drive-এ)
   Users · Cars · Documents · Assignments · Income · Expenses · DailyLogs
```

শিটে `car_plate` ও `driver_name` কলাম অটো লেখা হয়, তাই শিট খুললেও পড়া যায়। চাইলে Looker Studio দিয়ে সরাসরি এই শিট থেকে রিপোর্ট বানাতে পারবেন।

---

## সেটআপ (প্রথমবার, ~১৫ মিনিট)

### ধাপ ১ — Google Sheet ও Apps Script

1. Admin-এর Google অ্যাকাউন্টে নতুন Google Sheet খুলুন (নাম দিন যেমন `MAC CAR Data`)।
2. **Extensions → Apps Script** খুলুন।
3. `Code.gs`-এর সব লেখা মুছে দিন, তারপর এই রিপোর [`apps-script/Code.gs`](apps-script/Code.gs)-এর পুরো কোড পেস্ট করুন।
4. বাম দিকে ⚙️ **Project Settings** → ✅ **Show "appsscript.json" manifest file** চালু করুন। তারপর Editor-এ `appsscript.json` খুলে [`apps-script/appsscript.json`](apps-script/appsscript.json)-এর লেখা পেস্ট করুন। 💾 Save করুন।
5. উপরের ফাংশন লিস্ট থেকে **`setup`** সিলেক্ট করে ▶ **Run** চাপুন। Google পারমিশন চাইলে **Allow** দিন। "unsafe" দেখালে **Advanced → Go to project** চাপুন; এটা আপনার নিজের স্ক্রিপ্ট।
6. নিচে **Execution log**-এ দেখাবে:
   `First admin created → username: admin   password: xxxxxxxx`
   এই পাসওয়ার্ড লিখে রাখুন। শিটে ৭টি ট্যাব তৈরি হয়ে যাবে।

> 🔑 **পাসওয়ার্ড ভুলে গেলে বা নিজের পাসওয়ার্ড দিতে চাইলে (সবচেয়ে সহজ):** Google Sheet-এর **Users** ট্যাবে `set_password` কলামে (কলাম না থাকলে একবার `setup` চালান) সেই ইউজারের সারিতে নতুন পাসওয়ার্ড লিখুন। পরের লগিনে সেটাই পাসওয়ার্ড হয়ে যাবে এবং ঘরটা নিজে থেকে খালি হয়ে যাবে। ড্রাইভারদের জন্যও একইভাবে কাজ করে।

> 🔄 **আপডেটের পর (নতুন Code.gs পেস্ট করলে):** `appsscript.json`-ও নতুনটা পেস্ট করুন। তারপর একবার **setup** Run করুন — নতুন অনুমতি (Google Drive, অটোমেটিক সময়ে চালানো, বাইরের সার্ভিসে কানেক্ট) চাইবে, **Allow** দিন; নতুন কলাম/শিট (Payroll, CompanyCash, CarShares, PartnerWallet) নিজে থেকে যোগ হবে, পুরোনো ডাটা ঠিক থাকবে। তারপর Deploy → Manage deployments → ✏️ Edit → **New version** → Deploy।

### ধাপ ২ — Web App হিসেবে Deploy

1. উপরে ডানে **Deploy → New deployment**।
2. ⚙️ টাইপ: **Web app**।
3. **Execute as: Me**, **Who has access: Anyone** দিন। এতে ড্রাইভাররা Google অ্যাকাউন্ট ছাড়াই অ্যাপের username/password দিয়ে লগিন করতে পারবেন; শিট তবুও শুধু আপনার কাছেই থাকে।
4. **Deploy** চাপুন, তারপর যে **Web app URL** আসবে (শেষে `/exec`) সেটা কপি করুন।

> ⚠️ পরে `Code.gs` বদলালে: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**। তাহলে URL একই থাকবে।

### ধাপ ৩ — অ্যাপ অনলাইনে তোলা (Vercel, ফ্রি)

1. [vercel.com](https://vercel.com)-এ লগিন করে **Add New → Project** থেকে GitHub repo `MAC-CAR` ইমপোর্ট করুন।
2. MAC CAR-এর Apps Script লিংক কোডে (`src/lib/api.ts`) আগেই বসানো আছে, তাই কোনো Environment Variable না দিলেও চলবে। অন্য শিট ব্যবহার করতে চাইলে:
   - `EXPO_PUBLIC_API_URL` = নতুন `/exec` URL
   - `EXPO_PUBLIC_GOOGLE_CLIENT_ID` = (ঐচ্ছিক, ধাপ ৪ দেখুন)
3. **Deploy** চাপুন। Build ও output সেটিং `vercel.json`-এ দেওয়া আছে।
4. আপনার লিংক খুলে `admin` + ধাপ ১-এর পাসওয়ার্ড দিয়ে লগিন করুন।

### ধাপ ৪ — "Sign in with Google" চালু করা (ঐচ্ছিক)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → প্রজেক্ট সিলেক্ট/তৈরি → **Create credentials → OAuth client ID**।
   প্রথমবার হলে আগে **OAuth consent screen** সেটআপ করতে হবে (External, অ্যাপের নাম, আপনার ইমেইল)।
2. Application type: **Web application**।
   **Authorized JavaScript origins**-এ আপনার Vercel লিংক দিন (যেমন `https://mac-car.vercel.app`), আর লোকাল টেস্টের জন্য `http://localhost:8081`।
3. যে **Client ID** পাবেন:
   - Vercel-এ `EXPO_PUBLIC_GOOGLE_CLIENT_ID` হিসেবে দিন, তারপর Redeploy করুন।
   - Apps Script-এ `setGoogleClientId` ফাংশনে `PASTE-YOUR-CLIENT-ID…` জায়গায় বসিয়ে ▶ Run করুন।
4. এখন শিটের মালিক (Admin) নিজের Google দিয়ে লগিন করতে পারবেন। অন্য কাউকে Google দিয়ে লগিন করাতে চাইলে **User** মেনুতে তার "Google email" দিন। আরও Admin Google ইমেইল যোগ করতে Apps Script → Project Settings → Script properties-এ `ADMIN_EMAILS` (কমা দিয়ে আলাদা) রাখতে পারেন।

### ধাপ ৫ — মোবাইলে অ্যাপের মতো ইনস্টল

- **iPhone (Safari):** লিংক খুলুন → Share ⬆️ → **Add to Home Screen**
- **Android (Chrome):** লিংক খুলুন → ⋮ মেনু → **Install app / Add to Home screen**

হোম স্ক্রিনে MAC CAR আইকন আসবে এবং অ্যাপটি পুরো স্ক্রিনে খুলবে।

---

## প্রথম ব্যবহার (Admin)

1. **Car → Add car**: গাড়ির প্লেট নাম্বার, মডেল ইত্যাদি দিন। Details-এ গিয়ে **Documents → Add** দিয়ে Istimara, Insurance, Fahas-এর মেয়াদ দিন।
2. **Driver → Add driver**: নাম, username, password, লাইসেন্স ও ইকামার মেয়াদ দিন। এই username/password ড্রাইভারকে দিন।
3. গাড়ির Details বা ড্রাইভারের পেজে **Assign** চাপুন: কোন ড্রাইভার কোন তারিখ থেকে কোন গাড়ি চালাবে। ড্রাইভার গাড়ি বদলালে পুরোনোটায় ⏹ (End today) চাপুন, তারপর নতুন Assign করুন।
4. **Income → Add income**: গাড়ি কাকে, কত টাকায়, কোন সময়ের জন্য দেওয়া হয়েছে।
5. ড্রাইভাররা খরচ পাঠালে Dashboard বা Expense-এ ✅ Approve / ✖ Reject করুন। শুধু Approve করা খরচই লাভ-ক্ষতির হিসাবে ধরা হয়।

---

## লোকালি চালানো / ডেভেলপমেন্ট

```bash
npm install
cp .env.example .env          # তারপর .env-এ EXPO_PUBLIC_API_URL বসান
npx expo start --web          # ব্রাউজারে
npx expo start                # ফোনে Expo Go অ্যাপ দিয়ে QR স্ক্যান করে
npm run typecheck && npm run lint
npm run test:backend          # Code.gs-এর টেস্ট (নকল Google Sheets দিয়ে)
npm run build:web             # dist/ ফোল্ডারে ওয়েব বিল্ড
```

### পরে App Store / Play Store অ্যাপ বানাতে

একই কোড থেকে [EAS Build](https://docs.expo.dev/build/introduction/) দিয়ে: `npx eas-cli@latest build -p android` / `-p ios`।
(নেটিভ অ্যাপে Google লগিনের জন্য আলাদা Android/iOS client ID লাগবে; username/password লগিন এখনই কাজ করে।)

---

## ফোল্ডার

```
apps-script/      Google Sheets ব্যাকএন্ড (Code.gs, appsscript.json, টেস্ট)
src/app/          স্ক্রিন (Expo Router)
  login.tsx
  admin/          Dashboard, Car, Driver, Income, Expense, Report, User + car/[id], driver/[id]
  driver/         ড্রাইভার: Home, Add, History
src/components/   নিয়ন UI কিট, ফর্ম, লিস্ট রো
src/lib/          API, লগিন, হিসাব, রিপোর্ট ও প্রিন্ট
public/           PWA manifest, আইকন, index.html
```

## জেনে রাখুন

- প্রতিটি সেভ/লোড Google Apps Script দিয়ে হয়, তাই ১–৩ সেকেন্ড লাগতে পারে। কয়েকশো গাড়ি ও কয়েক বছরের ডাটা পর্যন্ত ঠিকঠাক চলবে।
- ব্যাকআপ: Google Sheet-এর **File → Version history** স্বয়ংক্রিয়ভাবে থাকে। চাইলে মাঝে মাঝে **File → Make a copy** করে রাখুন।
- শিটের কলামের নাম বা ক্রম হাতে বদলাবেন না। ডাটা দেখা, ফিল্টার বা কপি করা নিরাপদ।
- পাসওয়ার্ড শিটে হ্যাশ করে রাখা হয়; সেই কলাম শিটে লুকানো থাকে।
