import LegalPage from "@/components/legal/LegalPage";

/**
 * TEMPLATE Privacy Policy. Reviewed by a human/lawyer before publishing.
 * Replace the bracketed placeholders and confirm the data-practices match
 * the live system before launch.
 */
const Privacy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="May 26, 2026">
    <p>
      This Privacy Policy explains what ScoreboardRL ("we", "us") collects, how we use it, and the
      choices you have. ScoreboardRL is an independent, fan-made Rocket League stat tracker and is
      not affiliated with, endorsed by, or sponsored by Psyonix or Epic Games.
    </p>

    <h2>Information we collect</h2>
    <ul>
      <li><strong>Account information:</strong> your email address (for sign-in, verification, and password reset).</li>
      <li><strong>Profile information you provide:</strong> your Rocket League account name, optional bio, favorite car, and ranks.</li>
      <li><strong>Game data:</strong> match stats you log manually or by uploading a post-match scoreboard screenshot, including player names, scores, goals, assists, saves, shots, and results.</li>
      <li><strong>Uploaded images:</strong> scoreboard screenshots are sent to our parsing service to extract stats. We do not retain the game screenshot after parsing. Profile avatars and banners you upload are stored to display your profile.</li>
      <li><strong>Technical data:</strong> standard log and device information needed to operate and secure the service.</li>
    </ul>

    <h2>How we use information</h2>
    <ul>
      <li>To provide the core features: tracking, comparing, and displaying your match statistics.</li>
      <li>To show leaderboards and let you compare with friends and teammates you choose to connect with.</li>
      <li>To operate, secure, debug, and improve the service.</li>
      <li>To communicate account-related messages (verification, password reset).</li>
    </ul>

    <h2>How information is shared</h2>
    <p>
      Some information is visible to other signed-in users by design — for example, your profile name,
      ranks, and stats may appear on leaderboards, friend profiles, and shared-game views. You can
      opt out of the public leaderboard in Settings. We do not sell your personal information.
    </p>
    <p>We use the following service providers ("processors") to run the service:</p>
    <ul>
      <li><strong>Supabase</strong> — database, authentication, and file storage (hosted in the United States).</li>
      <li><strong>Google (Gemini API)</strong> — to read stats from uploaded scoreboard screenshots.</li>
    </ul>

    <h2>Data retention</h2>
    <p>
      We keep your account data until you delete it or your account. Uploaded scoreboard screenshots
      are not retained after stats are parsed. You can delete individual games at any time.
    </p>

    <h2>Your rights</h2>
    <p>
      You can access, export, and delete your data at any time from <strong>Settings → Danger Zone</strong>.
      "Export my data" downloads a JSON copy of your information; "Delete account" permanently removes
      your account and associated data. Depending on where you live (e.g. the EU/UK under GDPR, or
      California under CCPA), you may have additional rights — contact us to exercise them.
    </p>

    <h2>Children</h2>
    <p>
      ScoreboardRL is not directed to children under 13, and you must be at least 13 to create an
      account. If you believe a child under 13 has provided us information, contact us and we will
      delete it.
    </p>

    <h2>Cookies</h2>
    <p>
      We use only essential cookies/local storage required to keep you signed in and remember basic
      interface preferences. We do not use third-party advertising cookies.
    </p>

    <h2>Changes</h2>
    <p>
      We may update this policy from time to time. Material changes will be reflected by the "Last
      updated" date above.
    </p>

    <h2>Contact</h2>
    <p>
      Questions or data requests: <a href="mailto:[YOUR_SUPPORT_EMAIL]">[YOUR_SUPPORT_EMAIL]</a>.
    </p>
  </LegalPage>
);

export default Privacy;
