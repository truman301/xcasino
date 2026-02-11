"use client";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">
        <span className="text-white">Casino</span> <span className="text-[var(--gold)]">X</span> Terms of Service
      </h1>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Virtual Currency Disclaimer</h2>
          <p>
            Casino X is a <strong className="text-white">free-to-play social casino platform</strong> for entertainment purposes only.
            All chips and virtual currency used on this platform have <strong className="text-white">no real-world monetary value</strong> and
            <strong className="text-white"> cannot be redeemed, exchanged, or cashed out for real money</strong>, goods, or services.
          </p>
          <p className="mt-2">
            Purchases of virtual chips are final and non-refundable. Virtual chips are a limited license to use a digital item
            within the Casino X platform only.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Not Real Gambling</h2>
          <p>
            Casino X does not offer real-money gambling. No real money can be won or lost through gameplay.
            This platform is not a licensed gambling operator and does not facilitate gambling in any form.
            Playing on Casino X does not constitute gambling under any jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Age Requirement</h2>
          <p>
            You must be at least <strong className="text-white">18 years of age</strong> (or the age of majority in your jurisdiction)
            to use Casino X. By using this platform, you confirm that you meet this age requirement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. No Transfer of Virtual Items</h2>
          <p>
            Virtual chips and any other virtual items on Casino X are non-transferable. You may not sell, trade, gift,
            or otherwise transfer virtual chips to other users or third parties. Any attempt to do so may result in
            account termination.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Fair Play</h2>
          <p>
            All games on Casino X use random number generation for fair outcomes. You agree not to use any automated
            tools, bots, or exploits to manipulate gameplay. Casino X reserves the right to suspend or terminate
            accounts that violate fair play policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Responsible Play</h2>
          <p>
            While Casino X does not involve real money, we encourage responsible use of our platform. If you feel
            that your use of social casino games is becoming problematic, we encourage you to take breaks and seek
            support if needed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Account Termination</h2>
          <p>
            Casino X reserves the right to terminate or suspend any account at any time, for any reason,
            without prior notice. Virtual chips and items are not guaranteed and may be modified or removed
            at our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
          <p>
            Casino X is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages
            arising from the use of this platform, including but not limited to loss of virtual currency,
            service interruptions, or data loss.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of Casino X after changes constitutes
            acceptance of the updated terms.
          </p>
        </section>

        <div className="border-t border-[var(--casino-border)] pt-6 mt-8">
          <p className="text-gray-500 text-xs">
            Last updated: February 2026. If you have questions about these terms, please contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
