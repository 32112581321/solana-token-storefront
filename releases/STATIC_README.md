# Prebuilt storefront

This ZIP contains a static devnet demonstration. Extract it and serve the folder containing `index.html` with a local HTTP server, or upload that folder's contents to your static host.

For a local preview, if Python 3 is installed, open a terminal in this folder and run:

```sh
python3 -m http.server --bind 127.0.0.1 8080
```

Open `http://127.0.0.1:8080/` in your browser. Stop the server with Ctrl+C. Opening `index.html` directly from the filesystem will not load the configuration correctly.

Edit `storefront.config.json` for your public store and payment settings, `catalog.json` for products and prices, and `images/` for artwork. Keep inventory mode `static` unless you have separately installed and started the inventory service. The default recipient and mint belong to the upstream devnet demonstration; replace them for your own test setup.

For the editable TypeScript project and the local Node/SQLite inventory service, download the **source ZIP** from the same GitHub release. It requires Node.js 22.12+ and `npm ci`. The source project uses a `public/` directory for the JSON files and images; this prebuilt ZIP places those files at the top level.

Open `/roadmap.html` for the public roadmap. It reads `roadmap/graph.json`; the adjacent `create-requests.json` contains unsigned Devgraph create envelopes, not an automatic import. Use the source project to edit and validate these files together. The page needs no private tracker or wallet connection.

The `docs/` folder contains the user manual, community proposal, settlement-vault proposal, roadmap/import guide, release notes, and licensing notices. Those documents describe the full source project; repository-relative links and links to source-only files may require opening the [repository](https://github.com/32112581321/solana-token-storefront) or source ZIP. Dependency license texts are included in `docs/licenses/`.

The storefront does not create real merchandise orders or perform fulfillment. Community voting, profit splits, buybacks, and burns are proposals rather than implemented payment behavior. See `docs/RELEASE_NOTES.md` for the limits of this preview.
