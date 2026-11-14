# JobHunter: מדריך הקמה

את הקוד אני (Claude) כותב ומתחזק. החלק שלך הוא **לפתוח חשבונות ולהעתיק מפתחות**, כי את זה אסור לי לעשות בשמך. כל שלב לוקח 5 עד 10 דקות.

> 🔒 **מפתחות הם סיסמאות.** לא שולחים אותם בצ'אט ולא בשום מקום אחר. מדביקים אותם רק בקובץ `web/.env.local` ובמסכי ההגדרות של השירותים עצמם.

בסיום השלבים יהיו לך:
- אפליקציה שרצה באינטרנט, באייקון במסך הבית של ה-iPhone
- סריקה אוטומטית פעמיים ביום
- עלות של כ-5–15$ לחודש, בעיקר על AI

---

## שלב 1: Supabase (מסד הנתונים וההתחברות) · חינם

1. נרשמים בכתובת https://supabase.com עם **GitHub** (ממילא נצטרך אותו בשלב 6), או עם מייל וסיסמה. אין שם כניסה עם Google.
2. לוחצים **New project**:
   - שם: `jobhunter`
   - סיסמת מסד נתונים: לוחצים Generate ושומרים אותה במקום בטוח
   - אזור: **Frankfurt (eu-central-1)**, הקרוב לישראל
3. כשהפרויקט מוכן, נכנסים ל-**SQL Editor** ולוחצים **New query**. מדביקים את התוכן של `supabase/migrations/0001_init.sql` ואחריו את `0002_grants.sql`, ולוחצים **Run**.
   - אם קופץ חלון "Potential issues detected", לוחצים **Run and enable RLS**, הכפתור הירוק. אם לוחצים Cancel, שום דבר לא רץ.
   - 0002 נחוץ: מאוקטובר 2026, בפרויקטים חדשים טבלאות מוסתרות מהאפליקציה עד שנותנים להן הרשאה.
4. שומרים בצד שלושה ערכים:
   - כתובת הפרויקט: בכפתור **Connect**, או ב-**Project Settings ← Data API**
   - **Project Settings ← API Keys**: המפתח `publishable`, שבלשונית Legacy נקרא `anon`
   - באותו מסך: המפתח `secret`, שבלשונית Legacy נקרא `service_role`. זה המפתח הסודי ביותר: הוא נותן גישה מלאה לנתונים.

## שלב 2: התחברות עם Google · חינם

1. נכנסים ל-https://console.cloud.google.com ויוצרים פרויקט חדש בשם `jobhunter`.
2. **APIs & Services ← OAuth consent screen**:
   - סוג: External
   - שם האפליקציה: JobHunter
   - המייל שלך בשדות החובה
   - בחלק **Test users** מוסיפים את המייל שלך
3. **APIs & Services ← Credentials ← Create credentials ← OAuth client ID**:
   - סוג: Web application
   - ב-Authorized redirect URIs מדביקים: `https://<הפרויקט-שלך>.supabase.co/auth/v1/callback`. את הכתובת המדויקת רואים ב-Supabase תחת Authentication ← Providers ← Google.
4. מעתיקים את ה-**Client ID** ואת ה-**Client secret** ל-Supabase: **Authentication ← Providers ← Google**. מפעילים את הספק ושומרים.

## שלב 3: Google Maps (זמני נסיעה) · חינם בנפח שלנו

באותו פרויקט ב-Google Cloud:
1. **APIs & Services ← Library**: מחפשים **Routes API** ולוחצים Enable.
2. Google תבקש לחבר חשבון חיוב (Billing). זה מחייב כרטיס אשראי, ואת זה מזינים בעצמך. בנפח שלנו, עשרות חישובים בחודש, אין חיוב בפועל.
3. **Credentials ← Create credentials ← API key**:
   - לוחצים על המפתח שנוצר
   - בחלק **API restrictions** בוחרים **Routes API** בלבד
   - שומרים את המפתח בצד

## שלב 4: Anthropic (ה-AI שמדרג משרות) · כ-5–15$ לחודש

1. נרשמים בכתובת https://platform.claude.com.
2. **Billing**: טוענים 10$, ומגדירים **Spend limit** חודשי של 15$ כרשת ביטחון.
3. **API Keys ← Create Key** בשם `jobhunter`, ושומרים את המפתח בצד.

## שלב 5: הרצה ראשונה במחשב

1. בתיקייה `web` מעתיקים את הקובץ `.env.example` לקובץ חדש בשם `.env.local`.
2. פותחים את `.env.local` ב-Notepad ומדביקים את הערכים מהשלבים הקודמים:

   | שדה בקובץ | מאיפה |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL משלב 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public משלב 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role משלב 1 |
   | `GOOGLE_MAPS_API_KEY` | המפתח משלב 3 |
   | `ANTHROPIC_API_KEY` | המפתח משלב 4 |

3. כותבים לי "**הקובץ מוכן**". אני מפעיל את האפליקציה, אתה מתחבר עם Google, ואני מריץ את האתחול: פרופיל המאסטר, רשימת החברות, הרשימה השחורה וסריקה ראשונה.

## שלב 6: העלאה לאינטרנט (GitHub + Vercel) · חינם

את השלב הזה עושים אחרי שהכול עובד במחשב:
1. נרשמים ל-https://github.com. אני מכין את הקוד להעלאה ונותן לך פקודה אחת להריץ.
2. נרשמים ל-https://vercel.com עם חשבון ה-GitHub:
   - Import את הפרויקט
   - **Root Directory: `web`**
   - מדביקים את אותם חמישה משתנים מ-`.env.local`
3. מוסיפים את כתובת האתר שקיבלת מ-Vercel ב-Supabase, תחת **Authentication ← URL Configuration**: בשדה Site URL, וגם ברשימת Redirect URLs.
4. ב-GitHub, תחת **Settings ← Secrets and variables ← Actions**, מוסיפים כ-secrets את ארבעת המפתחות:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_MAPS_API_KEY`

   מעכשיו הסריקה רצה לבד ב-07:00 וב-17:00, בימים א' עד ה'.

## שלב 7: התקנה ב-iPhone

1. פותחים את כתובת האתר ב-**Safari** (רק ב-Safari זה עובד).
2. לוחצים על כפתור השיתוף ⎋ ואז **"הוסף למסך הבית"**.
3. מעכשיו האפליקציה נפתחת מהאייקון, בלי שורת כתובת.

### קיצור דרך: "הוסף ל-JobHunter" מתפריט השיתוף

את שני הערכים שצריך לקיצור הדרך, הכתובת והמפתח האישי, מוצאים במסך **הוספה** באפליקציה.

1. פותחים את אפליקציית **קיצורים** (Shortcuts) ולוחצים **+**.
2. לוחצים על ⓘ ומפעילים **"הצג בגיליון השיתוף"** (Show in Share Sheet). בסוגי הקלט בוחרים **URLs** ו-**Text**.
3. מוסיפים פעולה **"קבל תוכן של URL"** (Get Contents of URL):
   - **URL:** הכתובת ממסך ההוספה
   - **שיטה:** POST
   - **כותרות:** מפתח `Authorization` עם הערך `Bearer <המפתח האישי>`. המילה Bearer, רווח, ואחריו המפתח.
   - **גוף הבקשה:** JSON, עם שדה `url` שהערך שלו הוא **קלט קיצור הדרך** (Shortcut Input)
4. מוסיפים פעולה **"קבל ערך מילון"** (Get Dictionary Value) עם המפתח `message`.
5. מוסיפים פעולה **"הצג התראה"** (Show Notification) עם התוצאה.
6. נותנים לקיצור הדרך את השם **הוסף ל-JobHunter**.

**שימוש:** ב-LinkedIn פותחים משרה, לוחצים שיתוף ← "הוסף ל-JobHunter". אחרי כחצי דקה מגיעה התראה, והמשרה כבר מדורגת באפליקציה.
