# Marketly Frontend TODO

This list captures the next pass after the new frontend MVP.

1. Keep refining the TradingView Symbol Overview chart.
   - Replaced the quote-derived local chart with TradingView's live Symbol Overview embed.
   - Remaining polish is mostly visual because the iframe limits deep styling.

2. Keep improving the "Ask about..." workspace.
   - Follow-up answers now stay visible in a dashboard Ask Workspace panel.
   - Next pass: make the panel dockable/collapsible once the interaction pattern settles.

3. Make the Annual / Quarterly financials switcher real.
   - The frontend switch now changes chart period mode when quarterly labels are present.
   - Backend currently returns annual statement rows for the tested AAPL payload, so true quarterly charts still depend on quarterly statement data.

4. Expand the full financials workspace.
   - Removed the old "Open statements" action from the dashboard tab.
   - The Financials tab now shows statement summaries, metric cards, score inputs, and model-derived lenses from the analysis payload.

5. Keep news media honest.
   - News cards now use article image URLs only when the provider returns a valid external URL.
   - Otherwise they fall back to a clean source/ticker visual.

6. Improve analyst opinions.
   - Removed the unrelated "Latest Developments" bucket.
   - Replaced it with analyst/model opinions derived from analysis lenses and catalysts until richer analyst commentary is exposed.

7. Improve Analysis Stack placement.
   - Analysis Stack is now visible on the overview page.

8. Show more stock-related news in the News section.
   - Frontend now requests a larger 7-day news window and renders more stories.
   - Further filtering/ranking should happen once provider quality is reviewed.

9. Capitalize Key Issues titles.
   - Implemented title capitalization for scenario-derived issue titles.

10. Add company logos when backend returns them.
   - The frontend now supports `info.logo`, `info.image`, or `info.icon`.
   - Render's current AAPL `/financials` response does not include a company logo/image field, so backend enrichment is still needed.
