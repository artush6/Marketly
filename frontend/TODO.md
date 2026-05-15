# Marketly Frontend TODO

This list captures the next pass after the new frontend MVP.

1. Fix the main chart.
   - The chart is currently empty when we do not have usable historical price data.
   - Prefer TradingView live charts if possible, but skin/embed them so they look almost exactly like the current Marketly chart design.

2. Fix the "Ask about..." flow.
   - Submitting a follow-up currently does not create a useful interaction.
   - Explore a small right-side chat panel, a compact chat icon/window, or a bottom chat bar that feels native to the dashboard.

3. Make the Annual / Quarterly financials switcher real.
   - The control is visual only right now.
   - It should switch the chart inputs and labels between annual and quarterly backend data.

4. Replace "Open statements" with a full financials experience.
   - The current link opens the old Marketly design and can show missing data even though the backend stores useful financial data.
   - The Financials tab should become a dense, large financials workspace with everything we fetch, compute, and store, mixing numbers and graphs where appropriate.

5. Fix news images.
   - The current story images are not necessarily the actual images from the article.
   - Use article images only when the provider returns a real article image; otherwise show a clean source/ticker visual instead of misleading media.

6. Remove unrelated "Latest Developments".
   - Some items are not linked to the stock.
   - Replace the section with analyst opinions / rating commentary if we fetch that data.

7. Move the Analysis Stack onto the overview page.
   - The strengths, risks, and thesis are useful enough to be visible upfront, not hidden behind the Analysis tab.

8. Show more stock-related news in the News section.
   - If we fetch more valid stock-specific articles, expose them with a good browsing layout.

9. Capitalize Key Issues titles.
   - The first letter should always be capitalized, including scenario-derived titles.
