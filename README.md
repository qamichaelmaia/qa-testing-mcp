# MCP QA Engineer SDET

Servidor MCP com ferramentas especializadas em QA de software. Conecte em qualquer IDE ou cliente compatível com o Model Context Protocol e tenha acesso a análise de User Stories, estratégia de testes, BDD/Gherkin, testes de contrato (Pact), integração (Testcontainers), performance (k6), segurança (OWASP) e CI/CD.

---

## Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- npm 9+
- Git

---

## Instalação

```bash
# 1. Clonar ou entrar na pasta
cd mcp-testing

# 2. Instalar dependências
npm install

# 3. Compilar TypeScript
npm run build
```

Após o build, o servidor estará disponível em `dist/index.js`.

Para desenvolvimento sem build:

```bash
npm run dev   # usa tsx — não requer compilação
```

---

## Ferramentas disponíveis (tools)

| Tool | Descrição |
|------|-----------|
| `analyze_user_story` | Análise completa de User Story: decomposição, critérios, cenários por camada, mapa de riscos, dados de teste, checklist |
| `generate_test_strategy` | Estratégia de testes para o sistema: pirâmide adaptada, ferramentas, CI/CD, metas de cobertura, roadmap |
| `create_gherkin_scenarios` | Cenários BDD em Gherkin: happy path, negativos, edge cases, Esquema do Cenário, tabelas de dados |
| `design_contract_tests` | Contratos Pact (CDC): interações, provider states, matchers, versionamento, can-i-deploy |
| `design_integration_tests` | Testes de integração: Testcontainers, WireMock, setup/teardown, concorrência, observabilidade |
| `generate_performance_plan` | Plano k6 completo: smoke/load/stress/spike/soak, thresholds, análise de resultados |
| `security_test_checklist` | Checklist OWASP Top 10 por tipo de feature + headers, SAST/DAST, critérios de aceitação |
| `review_test_code` | Revisão de código de teste: anti-patterns, isolamento, asserções, mocks, cobertura |
| `troubleshoot_flaky_test` | Diagnóstico de flaky tests: hipóteses, passos, correções com código, política de prevenção |
| `generate_ci_pipeline` | Pipeline CI/CD com stages, paralelismo, cache, cobertura mínima, gates de qualidade |
| `quality_checklist` | Checklists por artefato: user story, plano, caso de teste, código, contrato, suíte, bug report |
| `generate_test_data` | Dados de teste sintéticos: válidos, inválidos, boundary, ausentes, PII mascarada, por categoria |
| `design_api_tests` | Testes funcionais, negativos e de segurança (OWASP API Top 10) para um endpoint específico |
| `generate_automation_code` | Scaffold de código de automação com boas práticas (seletores resilientes, waits, isolamento) |
| `optimize_test_suite` | Matriz de decisão para manter/mesclar/remover testes e priorização por risco |
| `self_healing_test_strategy` | Hierarquia de seletores, fallback chain e detecção de drift para automação resiliente |
| `manual_test_artifact_standard` | Define uma pasta e um único arquivo por User Story, com caso de teste, bugs, ajustes e evidências no mesmo documento |

### Padrão de artefatos manuais

Resultados de testes manuais devem ser criados em uma pasta por User Story, nunca na raiz:

```text
qa-artifacts/manual-tests/
  US-001-gerenciar-contatos-financeiros/
    US-001-gerenciar-contatos-financeiros.md
    evidencias/
```

Use o formato `US-001-<slug-da-historia>/US-001-<slug-da-historia>.md`. O arquivo deve conter `## Objetivo do teste`, `## Caso de teste`, `## Bugs encontrados` e `## Ajustes encontrados`. Bugs e ajustes são subseções do mesmo documento, e não arquivos separados. A tool `manual_test_artifact_standard` retorna o caminho, o nome e o template correto para cada nova User Story.

### Mapeamento com categorias de "agentes de IA para QA"

| Categoria | Cobertura no MCP |
|-----------|-------------------|
| AI Test Case Generation | `analyze_user_story`, `create_gherkin_scenarios` |
| AI Test Case Optimization | `optimize_test_suite` |
| AI-Assisted Automation Coding | `generate_automation_code`, `review_test_code` |
| AI Test Data Generation | `generate_test_data` |
| AI API Testing | `design_api_tests`, `design_contract_tests` |
| AI Test Failure Analysis | `troubleshoot_flaky_test` |
| QA Workflow Automation | `generate_ci_pipeline`, `generate_test_strategy` |
| AI Risk-Based Testing | `analyze_user_story` (mapa de riscos), `generate_test_strategy` |
| Self-Healing Test Automation | `self_healing_test_strategy` |
| Autonomous QA Agent | prompt `autonomous-qa-agent` (orquestra todas as tools acima em sequência) |

## Recursos disponíveis (resources)

| URI | Descrição |
|-----|-----------|
| `qa://pyramid` | Pirâmide de testes: distribuição, objetivos, anti-patterns |
| `qa://tool-matrix` | Matriz de seleção de ferramentas por linguagem e necessidade |
| `qa://gherkin-template` | Template completo de Feature File BDD |
| `qa://k6-templates` | Scripts k6 prontos: smoke, load, stress, spike, soak |
| `qa://glossary` | Glossário de termos QA/SDET |

## Prompts disponíveis

| Prompt | Descrição |
|--------|-----------|
| `analyze-story` | Sessão de análise de User Story |
| `start-tdd` | Sessão TDD guiada (Red → Green → Refactor) |
| `write-test-plan` | Elaboração de plano de testes |
| `debug-failure` | Diagnóstico de falha em teste ou ambiente |
| `autonomous-qa-agent` | Orquestra todas as tools em sequência: história → estratégia → dados → API → automação → CI |

---

## Configuração por IDE

### VS Code (GitHub Copilot Agent)

Crie ou edite `.vscode/mcp.json` na raiz do seu workspace:

```json
{
  "servers": {
    "qa-sdet": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-testing/dist/index.js"]
    }
  }
}
```

> Requer GitHub Copilot com suporte a MCP (VS Code 1.99+). Ative em **Settings → GitHub Copilot → MCP**.

Alternativa via `settings.json` do usuário (escopo global):

```json
{
  "mcp": {
    "servers": {
      "qa-sdet": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/caminho/absoluto/mcp-testing/dist/index.js"]
      }
    }
  }
}
```

---

### Cursor

Crie `.cursor/mcp.json` na raiz do projeto:

```json
{
  "mcpServers": {
    "qa-sdet": {
      "command": "node",
      "args": ["./mcp-testing/dist/index.js"]
    }
  }
}
```

Ou configure globalmente em **Cursor → Settings → MCP** via interface gráfica.

---

### Claude Desktop

**Windows** — edite `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-sdet": {
      "command": "node",
      "args": ["C:\\Users\\SeuUsuario\\caminho\\mcp-testing\\dist\\index.js"]
    }
  }
}
```

**macOS** — edite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-sdet": {
      "command": "node",
      "args": ["/Users/seuusuario/caminho/mcp-testing/dist/index.js"]
    }
  }
}
```

**Linux** — edite `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-sdet": {
      "command": "node",
      "args": ["/home/seuusuario/caminho/mcp-testing/dist/index.js"]
    }
  }
}
```

> Reinicie o Claude Desktop após editar o arquivo.

---

### Windsurf (Codeium)

Edite `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "qa-sdet": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-testing/dist/index.js"]
    }
  }
}
```

---

### Continue.dev

Edite `~/.continue/config.json` (ou `config.yaml`):

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/caminho/absoluto/mcp-testing/dist/index.js"]
        }
      }
    ]
  }
}
```

---

### Zed

Edite o arquivo de configuração do Zed (`~/.config/zed/settings.json`):

```json
{
  "context_servers": {
    "qa-sdet": {
      "command": {
        "path": "node",
        "args": ["/caminho/absoluto/mcp-testing/dist/index.js"]
      }
    }
  }
}
```

---

### Qualquer cliente MCP (genérico)

O servidor usa transporte **stdio** padrão. Configure com:

```json
{
  "command": "node",
  "args": ["/caminho/absoluto/para/mcp-testing/dist/index.js"],
  "transport": "stdio"
}
```

---

## Exemplos de uso

### No chat do IDE

```
Analise esta User Story:
"Como usuário, quero resetar minha senha para recuperar acesso à conta"
```

O assistente chamará `analyze_user_story` automaticamente e retornará a análise estruturada.

```
Crie cenários Gherkin para o fluxo de checkout com os critérios:
- Usuário com carrinho não vazio pode finalizar compra
- Pagamento com cartão inválido é rejeitado com mensagem
- Frete é calculado pelo CEP do endereço de entrega
```

```
Gere um plano de performance para POST /api/orders com SLA p95 < 400ms
```

```
Revise este código de teste:
[colar o código]
```

### Usando os prompts pré-construídos

Em IDEs que suportam prompts MCP (como Claude Desktop e Cursor):

- `/analyze-story` — análise de User Story
- `/start-tdd` — sessão TDD
- `/write-test-plan` — plano de testes
- `/debug-failure` — diagnóstico de falha

---

## Verificar se o servidor está funcionando

```bash
# Executar diretamente e verificar output de inicialização
node dist/index.js
# Deve exibir em stderr: "MCP QA SDET Server v2.0.0 pronto."

# Ou via npm
npm start
```

---

## Desenvolvimento

```bash
# Modo desenvolvimento (sem compilação)
npm run dev

# Compilar para produção
npm run build

# Watch mode (recompila ao salvar)
npx tsc --watch
```

---

## Troubleshooting

### "Cannot find module" ao executar

Execute `npm run build` antes de `npm start`. O diretório `dist/` precisa existir.

### Servidor não aparece no IDE

1. Verifique o caminho absoluto no arquivo de configuração
2. Confirme que Node.js 18+ está instalado: `node --version`
3. Confirme que o build foi gerado: `ls dist/index.js`
4. Reinicie o IDE após alterar a configuração

### Erros de TypeScript no build

```bash
npx tsc --noEmit   # verificar erros sem gerar arquivos
```

### Timeout ao conectar

Adicione `timeout` na configuração do cliente:

```json
{
  "command": "node",
  "args": ["/caminho/dist/index.js"],
  "timeout": 10000
}
```

---

## Estrutura do projeto

```
mcp-testing/
├── src/
│   └── index.ts          # Servidor MCP completo
├── dist/                 # Gerado pelo build (não versionar)
│   └── index.js
├── package.json
├── tsconfig.json
├── SYSTEM_PROMPT.md      # Prompt de sistema QA SDET Senior
└── README.md
```

---

## Tecnologias

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- TypeScript 5
- Node.js 18+

---

Desenvolvido por **Michael Maia** — QA Engineer SDET  
[LinkedIn](https://www.linkedin.com/in/qamichael/) · [GitHub](https://github.com/qamichaelmaia) · [QA Playground](https://playground-for-qa.vercel.app/)
