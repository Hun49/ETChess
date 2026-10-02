# ET-Chess --- User Experience Specification

**Project:** ET-Chess\
**Status:** Global UX baseline defined\
**Scope:** User-facing behavior, interaction, feedback, and failure
handling\
**Implementation boundary:** This document defines what the user
experiences, not how the system implements it.

------------------------------------------------------------------------

## 1. Purpose

This document defines the UX foundation for ET-Chess: what users see,
what they can do, what happens after an action, how the application
communicates state, and how it behaves during failures or unusual
situations.

The visual UI is already defined and locked for the current phase. This
document defines the behavioral layer that the UI must support.

------------------------------------------------------------------------

## 2. Global UX Principles

### 2.1 Contextual feedback

Feedback should be clear, concise, relevant to the current action,
appropriate to the severity of the situation, and adapted to web or
mobile where appropriate.

### 2.2 Preserve user context

When something goes wrong, preserve the user's current context whenever
possible. A failed request should not unnecessarily reset the page, and
a network interruption should not replace an active chess board with a
generic error screen.

### 2.3 Avoid unnecessary interruption

Do not use full-screen loaders, confirmation dialogs, modals, or other
disruptive UI when a smaller contextual interaction is sufficient.

### 2.4 No silent failures

If an operation that matters to the user fails, the application must
communicate the failure.

------------------------------------------------------------------------

## 3. First Launch and Entry

### First launch

1.  Show the ET-Chess splash screen.
2.  Proceed to the initial entry experience.
3.  Allow the user to enter as Guest or use an account.

### Guest access

Guests can:

-   Play against the computer/bot.
-   Play local Pass & Play on supported mobile experiences.

Guests do not receive persistent online/account functionality.

### Account-required functionality

An account is required for persistent online functionality such as:

-   Online multiplayer
-   Rating
-   Friends
-   Persistent multiplayer-related data
-   Other server-dependent account functionality

The web experience also requires an account for online multiplayer and
rating-related functionality.

Detailed sign-up, login, password recovery, and account-recovery UX is
intentionally deferred.

------------------------------------------------------------------------

## 4. Session Persistence

ET-Chess should provide a persistent-login experience.

-   Closing and reopening the application should not normally require
    login again.
-   The user remains logged in until explicitly logging out, unless
    authentication genuinely becomes invalid.
-   Session restoration occurs during startup/splash rather than briefly
    displaying an authentication screen.
-   A valid session should lead directly into the authenticated
    experience.
-   Authentication renewal, if required, should normally be invisible.
-   If authentication cannot be renewed, explain the situation and
    provide a way to authenticate again.
-   Do not silently discard user context.

### Startup flow

``` text
App Launch
    ↓
Splash Screen
    ↓
Restore / Validate Session
    ↓
Valid session → Home
No valid session → Guest / Start Entry
```

------------------------------------------------------------------------

## 5. Global Loading UX

ET-Chess uses contextual and proportional loading states.

### Page and data loading

Use skeletons, spinners, or other appropriate contextual loading states
depending on the content.

### Quick actions

Use the interaction/loading states already established by the UI design.

### Matchmaking

Use subtle animations and clear status feedback. No flashy or
distracting animation.

### Reconnection

During live-game reconnection:

-   Keep the chess board visible.
-   Blur the board.
-   Display a circular loading indicator.
-   Clearly communicate that reconnection is occurring.

### Analysis

Use an analysis-specific loading state. Do not unnecessarily block the
entire experience with a generic full-screen loader.

### History and data

Use contextual inline loading states.

### Slow operations

Do not show a loader unnecessarily for an operation that is normally
near-instant. If it remains active beyond a short, task-appropriate
delay, provide visible feedback that it is still processing.

### Animation principle

Animations should be subtle, short, purposeful, and consistent. Avoid
flashy effects.

### Game initialization

Game initialization should have an intentional transition into the game
experience and communicate when the game is ready. The exact
presentation is deferred to the specific game-flow UX.

------------------------------------------------------------------------

## 6. Error UX

ET-Chess uses a unified **in-app error-notification system** rather than
a separate error UI pattern for every error.

Every user-facing error should:

-   Explain what happened in plain language.
-   Use a message appropriate to the actual error.
-   Avoid exposing technical/internal details.
-   Provide a useful next action when appropriate.

Possible actions include Retry, Try Again, Reconnect, or Dismiss.

Presentation may adapt to severity, context, and web/mobile platform.
Errors must not silently fail.

------------------------------------------------------------------------

## 7. Empty States

Empty states use an **A + B model depending on relevance**:

-   Show a clear, concise message explaining that there is currently no
    content.
-   If there is a meaningful action, provide a relevant action/button.
-   If there is no useful action, show only the message.
-   Do not require decorative illustrations.

Examples:

-   No friends → "You haven't added any friends yet." → **Add Friend**
-   No game history → "No games played yet." → potentially **Play a
    Game**
-   No search results → "No players found." → no unrelated action
-   No challenges → "No active challenges." → potentially **Challenge a
    Friend**

------------------------------------------------------------------------

## 8. Network Failure UX

Connectivity failures should be handled automatically and visibly.

-   Show a persistent connection-status indicator when connectivity is
    lost.
-   Automatically attempt to reconnect.
-   Restore the connected state when connectivity returns.
-   Do not require a manual refresh.
-   Preserve current context whenever possible.
-   Connectivity-related action failures may also use the unified error
    notification system.

### Active game

During a live game:

-   Keep the board visible.
-   Blur the board during reconnection.
-   Show a circular loading indicator.
-   Show appropriate connection status.
-   Apply the established disconnect/grace-period rules.
-   Automatically synchronize the game state after reconnection.

The opponent receives appropriate connection-status feedback.

------------------------------------------------------------------------

## 9. In-App Notifications

The initial version uses a simple **in-app notification system**.
External/push notifications are outside the initial UX scope.

Notifications may communicate:

-   Friend requests
-   Game invitations/challenges
-   Challenge responses
-   Game results
-   Important account events
-   Other meaningful gameplay events

Notifications should be concise, relevant, and consistent across web and
mobile while adapting to each platform.

------------------------------------------------------------------------

## 10. Back Navigation

ET-Chess uses hierarchical back navigation.

-   A single back action returns to the immediate parent page.
-   Back navigation continues through the page hierarchy toward Home.
-   Once Home is reached, navigation terminates there.
-   The app must not keep looping through old pages.
-   On mobile, two rapid back actions from Home close/exit the
    application.
-   Mobile may use gestures/buttons; web may use browser/in-app
    navigation, while preserving the same hierarchy.

Example:

``` text
Child Page → Parent → Parent → Home
```

------------------------------------------------------------------------

## 11. Confirmation Dialogs

ET-Chess uses **modal confirmation dialogs with backdrops** for
consequential actions.

Use confirmation for actions that are destructive, difficult to reverse,
irreversible, or likely to cause meaningful loss of progress/state.

Do not confirm routine or easily reversible actions.

Dialogs should:

-   Appear above the current interface.
-   Use a backdrop.
-   Explain what is about to happen.
-   Clearly state important consequences.
-   Use action-specific labels instead of vague Yes/No choices.

### Leaving an active game

Leaving an active game is consequential.

1.  Attempting to leave an active game opens a confirmation modal.
2.  The modal clearly states that leaving will result in a loss.
3.  Cancel keeps the player in the game.
4.  Confirming abandons the game and results in a loss.
5.  A finished game does not require this active-game confirmation.

------------------------------------------------------------------------

## 12. Offline Behavior

ET-Chess remains useful without internet connectivity.

### Guest offline

Guests can:

-   Play against the computer/bot.
-   Play local Pass & Play on the mobile app.

### Authenticated user offline

Authenticated users can:

-   Play against the computer/bot.
-   Play local Pass & Play.
-   Use locally available settings/preferences.
-   Analyze eligible locally available games offline.
-   Access locally available/cached content where appropriate.

### Online-only functionality

The following require connectivity:

-   Online matchmaking
-   Friend games
-   Sending/receiving online challenges
-   Server-dependent friend management
-   Rating operations
-   Server-dependent profile operations
-   Server-dependent history operations
-   Other server-dependent multiplayer functionality

The app should clearly indicate when it is offline rather than making
online functionality appear broken.

### Offline usability principle

No internet connection should not make the mobile app feel unusable. The
user should still be able to play a bot, play Pass & Play, and analyze
eligible local games.

------------------------------------------------------------------------

## 13. Offline Analysis

Users can analyze eligible locally available games without an internet
connection.

-   Keep the analysis interface consistent with the normal analysis
    experience.
-   Show an analysis-in-progress state so the app does not appear
    frozen.
-   Analysis may take longer depending on the device and analysis depth.
-   Offline analysis does not affect ratings or online game results.

The exact local engine implementation is a technical concern, not a UX
requirement.

------------------------------------------------------------------------

## 14. Universal Game Clock UX

Each player has an individual clock.

-   A player's clock runs only during that player's turn.
-   It stops when the opponent's turn begins.
-   Reaching 0:00 means the player has flagged.
-   A player who flags loses immediately.
-   If the opponent cannot mathematically force checkmate because of
    insufficient material, a flag results in a draw.

The UI must communicate the resulting game state clearly.

------------------------------------------------------------------------

## 15. Game Modes

### Bullet

Typical controls: **1--2 minutes per player**.

Examples:

-   1+0
-   2+0

### Blitz

Typical controls: **3--5 minutes per player**.

Examples:

-   3+0
-   5+0
-   3+2

### Rapid

Typical controls: **10--30 minutes per player**.

Example:

-   10+0

Exact time-control selection UX is defined within specific game flows.

------------------------------------------------------------------------

## 16. Core Game Experience

The live game interface should provide:

-   Clear board state
-   Clear player identity
-   Clear clocks
-   Clear game status
-   Clear move feedback
-   Responsive interaction
-   Appropriate connection feedback
-   Clear result presentation

The chessboard and clocks take priority over unnecessary visual effects.

------------------------------------------------------------------------

## 17. Matchmaking UX

Matchmaking should feel active and responsive without becoming visually
distracting.

The user should understand:

-   That matchmaking is active.
-   That the system is searching.
-   That the search is still progressing.
-   When a match has been found.

Use subtle animation.

Ratings are separate by game mode. Matchmaking initially uses a
relatively narrow skill range and may expand it over time. Color
assignment should aim for balanced distribution and may prioritize
avoiding repeated color streaks.

The exact matchmaking algorithm is a technical/backend concern.

------------------------------------------------------------------------

## 18. Friend Game UX

Friend games are designed for direct and flexible play.

### Defaults

-   Casual/unrated by default.
-   Customizable.

### Customization

Where supported, users may select:

-   Time control
-   Rated/unrated
-   White / Random / Black
-   Material handicap

### In-game controls

Supported friend-game interactions include:

-   Takeback
-   Give opponent additional time
-   Rematch

Example time gifts include +15 seconds and +30 seconds.

------------------------------------------------------------------------

## 19. Quick Game Hub

The main game hub uses simple card/toggle-style choices:

-   **Play Online**
-   **Play a Friend**
-   **Play Computer**

The primary choices should be immediately understandable. Quick time
controls should be accessible where appropriate.

------------------------------------------------------------------------

## 20. Friend Invitation Flow

The intended flow is:

``` text
Play a Friend
    ↓
Customize Game
    ↓
Invitation / Gateway
    ↓
Search / Select Friend or Share Link
    ↓
Opponent Joins
    ↓
Game Starts
```

The invitation experience should clearly communicate waiting,
acceptance, decline, expiration, and readiness where applicable.

------------------------------------------------------------------------

## 21. Game Results

The result experience should clearly communicate:

-   Winner/draw
-   Reason for result where relevant
-   Rating changes for rated games
-   Relevant game information
-   Access to analysis

Possible result reasons include checkmate, resignation, flag, draw,
abandonment, and other established game-ending conditions.

------------------------------------------------------------------------

## 22. Post-Game Analysis

Stockfish analysis is available after games.

The analysis experience should answer:

1.  What happened?
2.  Where did I go wrong?
3.  What should I have played?
4.  Why was that move better?
5.  How did the game change because of the mistake?

The interface may identify:

-   Best moves
-   Inaccuracies
-   Mistakes
-   Blunders
-   Important turning points

The goal is to explain the game, not merely expose raw engine numbers.

Analysis uses its own contextual loading state and should not
unnecessarily block the whole application.

------------------------------------------------------------------------

## 23. Disconnect and Reconnection UX

Live-game connection handling has specialized behavior.

### Disconnected player

-   Keep the board visible.
-   Blur the board.
-   Show a circular loading indicator.
-   Communicate that reconnection is being attempted.

### Opponent

Show appropriate disconnected/reconnecting status.

### Reconnection

When the player reconnects:

-   Automatically restore the synchronized game state.
-   Do not require manual reconstruction.
-   Reflect the latest authoritative state.
-   Clearly reflect the latest opponent move if one occurred while
    disconnected.

The UX must reflect the established disconnect, grace-period,
abandonment, clock, and rating rules.

------------------------------------------------------------------------

## 24. Visual Language

The visual UI is defined separately and is currently locked.

The base interface uses a dark/neutral visual foundation with accent
colors.

Semantic accents:

-   **Green:** success / good
-   **Yellow:** warning / inaccuracy
-   **Red:** mistake / blunder

These colors should remain accents rather than dominate the interface.

------------------------------------------------------------------------

## 25. Web and Mobile Adaptation

The same product behavior should exist across web and mobile, while
interaction mechanisms may adapt to the platform.

Examples:

-   Mobile may use gestures and native back behavior.
-   Web may use browser navigation.
-   Notification placement may adapt to screen size.
-   Error presentation may adapt to platform conventions.
-   Layout may change responsively without changing the underlying
    product behavior.

Platform adaptation must not create contradictory product rules.

------------------------------------------------------------------------

## 26. Application State Philosophy

The application should always make its current state understandable.

Important states include:

-   Loading
-   Ready
-   Searching
-   Connected
-   Reconnecting
-   Offline
-   Error
-   Empty
-   Waiting for opponent
-   Game active
-   Game finished
-   Analysis running
-   Analysis complete

The user should never have to guess whether an action happened, failed,
is still processing, or is waiting on connectivity/opponent/analysis.

------------------------------------------------------------------------

## 27. Global UX Rules

1.  Feedback is contextual and proportional.
2.  Avoid unnecessary full-screen loading states.
3.  User-facing failures use the unified in-app error-notification
    system.
4.  Empty states use a concise message and a relevant action when
    useful.
5.  Network failures are visible and recover automatically where
    possible.
6.  Active games receive specialized reconnect/disconnect UX.
7.  Notifications are in-app only for the initial version.
8.  Back navigation follows the page hierarchy and terminates at Home.
9.  Two rapid back actions from Home exit the mobile application.
10. Destructive or consequential actions use modal confirmation with a
    backdrop.
11. Leaving an active game results in a loss after confirmation.
12. Users remain logged in persistently unless they log out or
    authentication genuinely becomes invalid.
13. Offline mobile use remains functional through Bot, Pass & Play, and
    eligible offline analysis.
14. Online functionality requires connectivity.
15. Animations are subtle, short, and purposeful.
16. Technical implementation details do not belong in the UX
    specification unless needed to define observable behavior.
17. Preserve user context whenever possible.
18. Do not silently fail.
19. Web and mobile can adapt interaction patterns while preserving the
    same underlying behavior.
20. Always make the current application state understandable.

------------------------------------------------------------------------

## 28. Current Scope Boundary

This document is the **global UX foundation**. The following are
intentionally deferred to feature-specific UX specifications:

-   Detailed authentication screens
-   Detailed Home-screen interactions
-   Play Online flow
-   Matchmaking configuration screens
-   Detailed friend/challenge screens
-   Computer/bot configuration
-   Local Pass & Play flow
-   Detailed live-game controls
-   Takeback flow
-   Time-gift flow
-   Rematch flow
-   Detailed disconnect/abandonment presentation
-   Game-history UX
-   Profile UX
-   Rating UX
-   Detailed analysis-page UX
-   Settings UX
-   Admin UX
-   Detailed notification-center UX

These should be defined individually when their respective feature UX is
designed.

------------------------------------------------------------------------

## 29. UX-to-Implementation Boundary

This document defines **what must happen from the user's perspective**.

It does not prescribe:

-   React/component architecture
-   State-management architecture
-   API architecture
-   Database structure
-   Durable Objects
-   WebSocket implementation
-   Authentication-token implementation
-   Storage mechanisms
-   Backend services
-   Specific libraries
-   Deployment architecture

Those belong in technical specifications. The implementation must
satisfy the observable behavior defined here.

------------------------------------------------------------------------

## 30. Status

**Global UX foundation: defined and sufficient for the current phase.**

The visual UI is defined and locked. The next phase can define
feature-specific UX flows, followed by technical/backend specifications
and implementation.
