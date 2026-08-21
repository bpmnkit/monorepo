# Installation — Worker client

For standalone workers that connect to Zeebe without the full SDK:

```sh
npm install @bpmnkit/worker-client
```

Workers scaffolded by `/implement` depend only on this package at runtime.


## TypeScript Requirements

All packages require **TypeScript 5.0+** with `strict: true`. The recommended `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

For browser/bundler projects (Vite, Webpack, etc.), use:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---
Source: https://docs.bpmnkit.com/getting-started/installation/
