import LegalPage from "@/components/legal/LegalPage";

/**
 * TEMPLATE Terms of Service. Reviewed by a human/lawyer before publishing.
 * Replace the bracketed placeholders before launch.
 */
const Terms = () => (
  <LegalPage title="Terms of Service" lastUpdated="May 26, 2026">
    <p>
      These Terms govern your use of ScoreboardRL ("the service"). By creating an account or using
      the service, you agree to these Terms. If you do not agree, do not use the service.
    </p>

    <h2>Who can use ScoreboardRL</h2>
    <p>
      You must be at least 13 years old to use the service. If you are under the age of majority where
      you live, you may use the service only with the involvement of a parent or guardian.
    </p>

    <h2>Your account</h2>
    <p>
      You are responsible for keeping your login credentials secure and for activity under your
      account. Provide accurate information and keep it up to date.
    </p>

    <h2>Acceptable use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Upload content that is unlawful, harassing, hateful, or infringes others' rights.</li>
      <li>Impersonate others or misrepresent identities in profile names or logged stats.</li>
      <li>Attempt to disrupt, overload, reverse-engineer, or abuse the service or its parsing/quota systems.</li>
      <li>Scrape or bulk-extract other users' data.</li>
    </ul>

    <h2>User content</h2>
    <p>
      You retain ownership of the content you submit (profile details, logged stats, uploaded images).
      You grant us a limited license to store, process, and display that content as needed to operate
      the service (for example, parsing a scoreboard, showing your stats on your profile and on
      leaderboards). You are responsible for the content you upload, including ensuring you have the
      right to share any names or images it contains.
    </p>

    <h2>Free service and quotas</h2>
    <p>
      The service is currently provided free of charge. Certain features (such as photo-parsing) are
      subject to usage quotas to keep the shared service available to everyone. We may change features
      and quotas over time.
    </p>

    <h2>Intellectual property</h2>
    <p>
      ScoreboardRL is an independent, fan-made project and is <strong>not affiliated with, endorsed by,
      or sponsored by Psyonix or Epic Games</strong>. "Rocket League" and related names and marks are
      trademarks of their respective owners and are used here only for identification and reference.
    </p>

    <h2>Termination &amp; deletion</h2>
    <p>
      You can delete your account at any time from Settings → Danger Zone. We may suspend or terminate
      accounts that violate these Terms or that we reasonably believe pose a risk to the service or
      other users.
    </p>

    <h2>Disclaimers</h2>
    <p>
      The service is provided "as is" and "as available", without warranties of any kind. We do not
      guarantee that stats parsed from images are accurate or that the service will be uninterrupted
      or error-free.
    </p>

    <h2>Limitation of liability</h2>
    <p>
      To the maximum extent permitted by law, ScoreboardRL and its operators will not be liable for
      any indirect, incidental, or consequential damages arising from your use of the service.
    </p>

    <h2>Changes</h2>
    <p>
      We may update these Terms from time to time. Continued use after changes take effect constitutes
      acceptance of the updated Terms.
    </p>

    <h2>Contact</h2>
    <p>
      Questions or reports of abuse: <a href="mailto:[YOUR_SUPPORT_EMAIL]">[YOUR_SUPPORT_EMAIL]</a>.
    </p>
  </LegalPage>
);

export default Terms;
