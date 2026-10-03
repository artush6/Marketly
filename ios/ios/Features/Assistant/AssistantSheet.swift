import SwiftUI

struct AssistantSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let context: AssistantContext
    @State private var model = AssistantViewModel()
    @FocusState private var inputFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var suggestions: [String] {
        if context.article != nil {
            return ["Summarize this story", "Which companies could be affected?"]
        }

        if context.symbol != "MARKET" {
            return [
                "Analyze \(context.symbol)", "What could change the thesis?",
                "Explain the valuation",
            ]
        }

        return [
            "Why are markets moving today?", "Compare AAPL vs MSFT",
            "Summarize today's market news", "Find interesting small-cap companies",
        ]
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                contextBar
                conversation
                composer
            }

            .marketScreen().navigationTitle("Marketly assistant").navigationBarTitleDisplayMode(
                .inline
            ).toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Image(systemName: "sparkles").foregroundStyle(MarketTheme.accentMint)
                        .accessibilityHidden(true)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }

                        .accessibilityIdentifier("assistant-done")
                }
            }
        }

        .presentationBackground(MarketTheme.background).preferredColorScheme(.dark).tint(
            MarketTheme.accentMint
        )

        .onDisappear { model.cancel() }
    }

    private var contextBar: some View {
        HStack(spacing: 8) {
            Image(systemName: context.article == nil ? "scope" : "newspaper")
            Text(context.name).lineLimit(1)
            Spacer()
            ModeLabel()
        }

        .font(.caption).foregroundStyle(MarketTheme.secondaryText).padding(.horizontal, 20).padding(
            .vertical, 12
        ).background(MarketTheme.surface)
    }

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if model.messages.isEmpty { introduction }

                    ForEach(model.messages) { message in messageView(message) }

                    if !model.sources.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Eyebrow(text: "Sources")
                            ForEach(model.sources) { source in
                                if let url = ArticleDTO.safeURL(source.url) {
                                    Link(source.title ?? url.host ?? "Source", destination: url)
                                        .font(.caption)
                                }
                            }
                        }
                    }

                    if let error = model.error {
                        Text(error).font(.caption).foregroundStyle(MarketTheme.warning)
                            .accessibilityIdentifier("assistant-error")
                    }

                    Color.clear.frame(height: 1).id("conversation-bottom")
                }

                .padding(20)
            }

            .scrollDismissesKeyboard(.interactively).onChange(of: model.messages.last?.content) {
                _, _ in
                if !inputFocused {
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.12)) {
                        proxy.scrollTo("conversation-bottom", anchor: .bottom)
                    }
                }
            }
        }
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("A sharper question.\nA clearer perspective.").font(.title2.weight(.semibold))
                .tracking(-0.5)
            Text("Explore the evidence behind the move.").font(.subheadline).foregroundStyle(
                MarketTheme.secondaryText)
            ForEach(suggestions, id: \.self) { suggestion in
                Button {
                    model.prompt = suggestion
                    send()
                } label: {
                    HStack {
                        Text(suggestion).multilineTextAlignment(.leading)
                        Spacer(minLength: 8)
                        Image(systemName: "arrow.up.left")
                    }

                    .font(.subheadline).padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(MarketTheme.surface, in: RoundedRectangle(cornerRadius: 10))
                }

                .buttonStyle(.plain)
            }
        }
    }

    private func messageView(_ message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Label(
                message.role == .user ? "You" : "Marketly",
                systemImage: message.role == .user ? "person.crop.circle" : "sparkles"
            ).font(.caption.weight(.semibold)).foregroundStyle(
                message.role == .user ? MarketTheme.secondaryText : MarketTheme.accentMint)

            if message.content.isEmpty && model.isSending {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Reviewing your question…").font(.caption)
                }

                .foregroundStyle(MarketTheme.secondaryText)
            } else {
                Text(.init(message.content)).font(.subheadline).lineSpacing(5).textSelection(
                    .enabled
                ).accessibilityIdentifier(
                    message.role == .assistant ? "assistant-response" : "user-message")
            }
        }

        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(
            message.role == .user ? MarketTheme.elevatedSurface : MarketTheme.surface,
            in: RoundedRectangle(cornerRadius: 12))
    }

    private var composer: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                Menu {
                    Picker("Research strategy", selection: $model.strategy) {
                        ForEach(ResearchStrategy.allCases) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Label(model.strategy.rawValue, systemImage: "slider.horizontal.3")
                }

                Menu {
                    Picker("Investment horizon", selection: $model.horizon) {
                        ForEach(InvestmentHorizon.allCases) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Label(model.horizon.rawValue, systemImage: "clock")
                }

                Spacer(minLength: 0)
            }

            .font(.caption).foregroundStyle(MarketTheme.secondaryText).disabled(model.isSending)

            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask a research question…", text: $model.prompt, axis: .vertical)
                    .lineLimit(1...4).font(.subheadline).focused($inputFocused).padding(13)
                    .background(MarketTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityIdentifier("assistant-input")
                if model.isSending {
                    Button {
                        model.cancel()
                    } label: {
                        Image(systemName: "stop.fill").frame(width: 44, height: 44)
                    }

                    .accessibilityLabel("Stop response")
                } else {
                    Button(action: send) {
                        Image(systemName: "arrow.up").font(.headline).foregroundStyle(
                            MarketTheme.background
                        ).frame(width: 44, height: 44).background(
                            MarketTheme.accentMint, in: Circle())
                    }

                    .disabled(
                        model.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || model.prompt.count > 3_500
                    ).accessibilityLabel("Send question").accessibilityIdentifier("assistant-send")
                }
            }

            HStack {
                Toggle(isOn: $model.searchWeb) {
                    Label("Search web", systemImage: "globe").font(.caption).foregroundStyle(
                        MarketTheme.secondaryText)
                }

                .toggleStyle(.switch).fixedSize().disabled(model.isSending)
                Spacer()
                Text(
                    model.prompt.count > 3_500
                        ? "Question too long"
                        : app.mode == .demo ? "Demo responses" : "Check original sources"
                ).font(.system(size: 9)).foregroundStyle(MarketTheme.tertiaryText)
            }
        }

        .padding(16).background(MarketTheme.surface)
    }

    private func send() {
        inputFocused = false
        model.send(context: context, service: app.services.assistant)
    }
}
