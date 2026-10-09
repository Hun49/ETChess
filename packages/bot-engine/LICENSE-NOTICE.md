# UCI Engine & Stockfish License Notice

## 1. Universal Chess Interface (UCI) Protocol
`@etchess/bot-engine` provides an open TypeScript abstraction layer implementing the Universal Chess Interface (UCI) protocol specification. The package communicates with external UCI-compliant chess engines via standard standard I/O / message transports (`uci`, `isready`, `position`, `go`, `bestmove`).

## 2. Stockfish License Obligations (GNU GPLv3)
Stockfish is an open-source chess engine developed by the Stockfish developers and licensed under the **GNU General Public License version 3 (GPLv3)**.

* **Repository Policy**: No compiled Stockfish binaries, modified source code, or NNUE neural network weight files are bundled directly within this repository.
* **Downstream / Client Distribution Notice**: If a downstream client, web application, or mobile build embeds or distributes Stockfish (such as Stockfish.js / WebAssembly or native binaries):
  1. The complete GPLv3 license text must be distributed with the binary/asset.
  2. The complete corresponding source code of the exact Stockfish version used must be made accessible to users in accordance with Section 6 of the GNU GPLv3.
  3. Prominent notices stating that Stockfish is used and licensed under GPLv3 must be included in user-facing application notices and documentation.
  4. Any modifications to the engine must be published under the GPLv3.

Reference: [Stockfish Engine Repository (GPLv3)](https://github.com/official-stockfish/Stockfish)
