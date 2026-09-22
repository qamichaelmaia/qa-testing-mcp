#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "mcp-qa-sdet", version: "2.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// ─── Input validation ─────────────────────────────────────────────────────────

const MAX_FIELD_LEN = 50_000;

/** Remove null bytes and enforce max length on all user-supplied strings. */
function sanitizeInput(value: string): string {
  return value.replace(/\x00/g, "").slice(0, MAX_FIELD_LEN);
}

function str(value: unknown): string {
  if (value == null) return "";
  return sanitizeInput(String(value));
}

function optStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  return sanitizeInput(String(value));
}

// ─── Allowed value sets ───────────────────────────────────────────────────────

const VALID_PERF_TYPES = new Set(["smoke", "load", "stress", "spike", "soak"]);
const VALID_CI_TEST_TYPES = new Set(["unit", "contract", "integration", "e2e", "performance", "security", "accessibility"]);
const VALID_PLATFORMS = new Set(["github-actions", "gitlab-ci", "azure-devops", "jenkins", "bitbucket-pipelines", "circleci"]);
const VALID_ARTIFACT_TYPES = new Set(["user-story", "test-plan", "test-case", "test-code", "api-contract", "test-suite", "bug-report", "acceptance-criteria"]);

// ─── Tool implementations ─────────────────────────────────────────────────────

function analyzeUserStory(args: Record<string, unknown>): string {
  const story = str(args.story);
  const context = optStr(args.context);
  const stack = optStr(args.tech_stack);
  const featureType = optStr(args.feature_type);

  const featureRisks: Record<string, string[]> = {
    auth: ["Brute force / credential stuffing", "Token expirado ou inválido não rejeitado", "Session fixation", "Bypass de MFA", "Account enumeration via timing/response", "Reset link reutilizável"],
    payment: ["Double charge em retry automático", "Race condition em saldo/estoque", "Manipulação de valor no payload", "Chargeback e fraude", "PCI-DSS: dados de cartão expostos", "Refund abuse"],
    "file-upload": ["Upload de arquivo malicioso (webshell)", "Path traversal", "MIME type spoofing", "DoS via arquivos gigantes", "Execução de código server-side"],
    api: ["Broken Object Level Authorization (BOLA/IDOR)", "Mass assignment", "Rate limiting ausente", "Exposição de stack trace", "Versão antiga de API sem suporte"],
    data: ["SQL/NoSQL injection", "Acesso não autorizado a dados de outro usuário", "Data leakage em log", "LGPD/GDPR compliance", "Exportação em massa sem controle"],
    admin: ["Privilege escalation", "Acesso de não-admin a endpoints privilegiados", "CSRF em ações críticas", "Auditoria incompleta de ações"],
    search: ["Injection via query", "Dados sensíveis nos resultados", "Enumeração de recursos privados", "DoS via queries complexas"],
    notification: ["Entrega para destinatário errado", "Conteúdo sensível em notificação", "Open redirect em links", "Rate limit de envio"],
    "third-party-integration": ["SSRF via webhook/callback", "Secret exposto em log", "Falha sem degradação graciosa", "Dados de terceiro persistidos sem consentimento"],
  };

  const risks = featureType && Object.hasOwn(featureRisks, featureType) ? featureRisks[featureType] : [];

  return `# Análise QA — User Story

## Entrada recebida
- **História:** ${story}
${context ? `- **Contexto:** ${context}` : ""}
${stack ? `- **Stack:** ${stack}` : ""}
${featureType ? `- **Tipo de feature:** ${featureType}` : ""}

---

## 1. Decomposição da história

Identifique e explicite:

| Elemento | Descrição |
|----------|-----------|
| **Ator** | Quem realiza a ação |
| **Ação** | O que o ator deseja fazer |
| **Benefício** | Valor ou resultado esperado |
| **Critérios implícitos** | O que não foi dito mas é esperado (ex.: autenticação requerida, feedback visual, persistência de dados) |

---

## 2. Critérios de aceitação

Derive critérios observáveis e testáveis. Cada critério deve:
- Ser verificável objetivamente (sim/não, valor exato)
- Ter dado de entrada claro
- Ter resultado esperado específico
- Ser independente dos demais quando possível

---

## 3. Cenários de teste por camada

### Unitários (70-80%)
- Regras de validação isoladas (cada campo, cada regra)
- Transformações e cálculos
- Decisões e ramificações (if/switch/match)
- Tratamento de exceções internas
- Boundary values (mín, máx, mín-1, máx+1)

### Testes de contrato (5-10%)
- Payload de request e response das APIs envolvidas
- Schema de eventos publicados ou consumidos
- Headers, status codes e matchers por campo
- Provider states para cada cenário

### Integração (15-25%)
- Fluxo Controller → Service → Repository com banco real/Testcontainers
- Chamadas a serviços externos (mock determinístico via WireMock/Nock)
- Persistência, rollback e transações
- Comportamento em indisponibilidade de dependência

### E2E (5-10%)
- Jornada crítica completa do usuário (happy path)
- Cenário de erro mais relevante ao usuário final
- Somente para fluxos que não podem ser validados em camadas inferiores

---

## 4. Mapa de riscos
${
  risks.length > 0
    ? `\n### Riscos específicos para o tipo **${featureType}**\n${risks.map((r) => `- ${r}`).join("\n")}\n`
    : ""
}

### Riscos gerais

| Risco | Impacto | Probabilidade | Camada de cobertura |
|-------|---------|---------------|---------------------|
| Entrada inválida por campo | Alto | Alta | Unitário |
| Falha de serviço externo | Alto | Média | Integração com mock |
| Concorrência / race condition | Alto | Média | Integração + carga |
| Boundary values | Médio | Alta | Unitário |
| Autenticação ausente | Alto | Baixa | Integração + E2E |
| Dados sensíveis expostos | Alto | Baixa | Segurança |
| Idempotência violada | Médio | Média | Integração |
| Performance degradada | Médio | Baixa | Performance |

---

## 5. Perguntas de qualidade

Responda antes de escrever os testes:

1. O que acontece se o usuário não está autenticado ou autorizado?
2. Qual é o comportamento exato para cada campo inválido (null, vazio, fora do limite, tipo errado)?
3. Existe rate limiting? Qual é o comportamento ao exceder?
4. O que acontece quando um serviço dependente está indisponível ou retorna erro?
5. Há concorrência possível? A operação é idempotente?
6. Os dados são persistidos? Qual é o comportamento em falha de persistência?
7. O que aparece no log de auditoria? Dados sensíveis são mascarados?
8. Existem dados pessoais envolvidos? (LGPD, GDPR, PCI-DSS aplicável?)
9. Qual é o comportamento em degradação de latência ou memória baixa?
10. Há impacto em funcionalidades existentes? (regressão)

---

## 6. Dados de teste

| Categoria | Descrição | Exemplo prático |
|-----------|-----------|-----------------|
| Válido canônico | Dados bem formados dentro dos limites | Todos os campos preenchidos corretamente |
| Inválido por campo | Cada campo inválido isolado | Email sem @, inteiro negativo onde positivo esperado |
| Vazio / ausente | Campo obrigatório nulo ou ausente | null, undefined, string vazia, campo não enviado |
| Boundary | Limite mínimo, máximo e um além de cada | 0, 1, MAX-1, MAX, MAX+1 |
| Caracteres especiais | SQL, HTML, Unicode, emojis, espaços | \`' OR 1=1\`, \`<script>\`, \`à\`, \`🎯\`, \`   \` |
| Concorrência | Mesmo recurso em paralelo | Dois POSTs simultâneos para o mesmo recurso |
| Dados de produção | Volume e diversidade realistas (anonimizados) | Dataset com variações de formato real |

---

## 7. Dependências e integrações
${stack ? `\nStack identificada: **${stack}**\n` : ""}
Mapeie e documente:
- APIs externas chamadas (URL, método, payload)
- Banco de dados (queries críticas, transações)
- Eventos publicados e consumidos (topic/queue, schema)
- Cache (Redis, Memcached): invalidação e fallback
- Serviços de autenticação/autorização

---

## 8. Checklist de completude

- [ ] Happy path documentado e coberto
- [ ] Todos os cenários negativos identificados e cobertos
- [ ] Edge cases e boundary values incluídos
- [ ] Requisitos não funcionais (performance, segurança) com cobertura definida
- [ ] Cada dependência externa tem estratégia de mock/stub explícita
- [ ] Dados de teste isolados por cenário (sem compartilhamento de estado)
- [ ] Cada critério de aceitação vinculado a pelo menos um teste
- [ ] Impacto em regressão avaliado e testes existentes executados
- [ ] Acessibilidade considerada (se há UI)
- [ ] Observabilidade validada: logs, métricas e traces emitem corretamente

---

Produza agora a análise completa desta história utilizando o framework acima.`;
}

function generateTestStrategy(args: Record<string, unknown>): string {
  const system = str(args.system_description);
  const stack = optStr(args.tech_stack);
  const arch = optStr(args.architecture) ?? "não especificada";
  const teamSize = optStr(args.team_size) ?? "não especificado";
  const constraints = optStr(args.constraints);

  const archNotes: Record<string, string> = {
    microservices: "Testes de contrato (CDC com Pact) são críticos. Prefira integração focada por serviço a E2E entre múltiplos serviços.",
    serverless: "Testes unitários dominam. Use LocalStack ou mocks para AWS/GCP/Azure. Cold start deve ser validado em performance.",
    monolith: "Integração com banco real (Testcontainers) é o centro da estratégia. E2E cobre jornadas completas.",
    "modular-monolith": "Contratos entre módulos substituem contratos de rede. Integração entre módulos é a camada crítica.",
    "event-driven": "Valide schema, ordering, idempotência, retry e dead-letter. Testes de contrato para eventos são essenciais.",
  };

  const note = arch !== "não especificada" ? archNotes[arch] : null;

  return `# Estratégia de Testes — ${system.slice(0, 60)}

## Entrada recebida
- **Sistema:** ${system}
${stack ? `- **Stack:** ${stack}` : ""}
- **Arquitetura:** ${arch}
- **Tamanho do time:** ${teamSize}
${constraints ? `- **Restrições:** ${constraints}` : ""}
${note ? `\n> **Nota arquitetural:** ${note}` : ""}

---

## 1. Pirâmide de testes recomendada

| Camada | Distribuição | Execução | Feedback | Custo |
|--------|-------------|----------|----------|-------|
| **Unitário** | 70-80% | < 1 min | Imediato | Muito baixo |
| **Contrato** | 5-10% | 1-3 min | Rápido | Baixo |
| **Integração** | 15-25% | 5-15 min | Médio | Médio |
| **E2E / UI** | 5-10% | 10-30 min | Lento | Alto |
| **Performance** | 2-5% | Variável | Por agendamento | Médio-alto |
| **Segurança** | 1-3% | Variável | Por agendamento | Médio-alto |

> Ajuste os percentuais pelo risco real: sistema de pagamentos exige mais segurança e integração; biblioteca de regras exige mais unitários.

---

## 2. Por tipo de teste

### Testes unitários
- **Ferramentas:** ${stack?.includes("Java") ? "JUnit 5, Mockito, AssertJ" : stack?.includes("Python") ? "Pytest, unittest.mock" : stack?.includes("C#") ? "NUnit, Moq" : "Jest/Vitest (TS/JS), Pytest (Python), JUnit 5 (Java)"}
- **Padrão:** Arrange-Act-Assert (AAA), um assert por comportamento, nomes descritivos
- **Escopo:** Uma unidade isolada — sem I/O, sem banco, sem rede
- **Cobertura alvo:** 80-90% em lógica de negócio crítica, 70%+ no geral
- **Quando rodar:** A cada commit, em < 1 min

### Testes de contrato
- **Ferramentas:** Pact / Pact Broker (multi-stack), Spring Cloud Contract (Java), Jest Pact (JS/TS)
- **Fluxo:** Consumer escreve expectativas → gera contrato → Provider valida em CI → Pact Broker registra compatibilidade
- **Quando rodar:** Em Pull Requests antes do merge

### Testes de integração
- **Banco:** Testcontainers (banco idêntico ao de produção), ou H2 somente se diferenças forem aceitáveis
- **APIs externas:** WireMock (Java), Nock/MSW (JS/TS), VCR/responses (Python)
- **Filas/eventos:** Embedded Kafka, RabbitMQ via Testcontainers, @spring-boot/embedded-kafka
- **Cobertura:** Fluxos Controller → Service → Repository, rollback, transações, dead-letter
- **Quando rodar:** Em Pull Requests, em paralelo com unitários

### Testes E2E / UI
- **Ferramentas:** Playwright (preferido), Cypress (ecossistema JS), Selenium (legado/multi-browser)
- **Seletor:** data-testid → aria > id estável > texto > CSS estrutural (evitar)
- **Escopo:** Apenas jornadas críticas. Evite E2E para validações que integração cobre melhor.
- **Quando rodar:** Após deploy em ambiente de staging

### Testes de performance
- **Ferramenta:** k6 (scripting em JS/TS, integração com CI), JMeter, Gatling, Locust
- **Tipos:** smoke (1 VU), load (carga nominal), stress (limite), spike (pico súbito), soak (longo prazo)
- **Métricas:** p50, p95, p99, req/s, taxa de erro, CPU, memória
- **Quando rodar:** Regressão semanal ou gates pré-release

### Testes de segurança
- **SAST:** SonarQube, Semgrep, CodeQL
- **DAST:** OWASP ZAP, Burp Suite (manual), Nuclei
- **Dependências:** \`npm audit\`, Dependabot, Snyk, OWASP Dependency-Check
- **Quando rodar:** SAST em cada PR; DAST em ambiente de staging pré-release

---

## 3. Fluxo CI/CD por estágio

\`\`\`
Commit ──→ [1. Lint + Typecheck + Unit Tests]  (<2 min)
              │
              ▼
Pull Request ──→ [2. Contrato + Integração]  (<15 min, paralelo)
                    │
                    ▼
Merge ──→ [3. Build + E2E Smoke]  (<10 min)
              │
              ▼
Staging ──→ [4. E2E Regressão + DAST]  (<30 min)
              │
              ▼
Release ──→ [5. Performance + Segurança completa]
\`\`\`

---

## 4. Alvos de qualidade

| Métrica | Alvo sugerido |
|---------|---------------|
| Cobertura de código (geral) | ≥ 70% |
| Cobertura (código crítico) | ≥ 85% |
| Duração unitários + contrato | < 3 min |
| Duração integração | < 15 min |
| Taxa de flakiness | < 2% |
| Escaped defects por sprint | 0 críticos, ≤ 2 médios |
| Tempo de feedback no PR | < 10 min |
| Latência p95 (SLA base) | Definir por fluxo |

---

## 5. Roadmap de implementação (fases)

### Fase 1 — Base (1-2 sprints)
- [ ] Configurar Jest/Pytest/JUnit com cobertura mínima
- [ ] Implementar testes unitários nos módulos críticos
- [ ] Configurar CI básico: lint + unitários em PRs

### Fase 2 — Integração (2-4 sprints)
- [ ] Integrar Testcontainers ou equivalente
- [ ] Cobrir repositórios, serviços e rotas críticas
- [ ] Adicionar estágio de integração no CI

### Fase 3 — Contratos e E2E (3-5 sprints)
- [ ] Implementar Pact nos limites entre serviços
- [ ] Criar suíte E2E para jornadas críticas com Playwright
- [ ] Adicionar Pact Broker ao fluxo de deploy

### Fase 4 — Performance e Segurança (2-3 sprints)
- [ ] Criar plano k6 com smoke e load para endpoints principais
- [ ] Configurar SAST no CI e DAST em staging
- [ ] Definir SLAs formais e gates de qualidade

---

Adapte esta estratégia ao contexto real do sistema e implemente em ordem de risco, não de camada.`;
}

function createGherkinScenarios(args: Record<string, unknown>): string {
  const feature = str(args.feature_name);
  const criteria = str(args.acceptance_criteria);
  const role = optStr(args.user_role) ?? "usuário";
  const context = optStr(args.context);

  return `# Cenários BDD — ${feature}

## Entrada recebida
- **Feature:** ${feature}
- **Papel:** ${role}
- **Critérios:** ${criteria}
${context ? `- **Contexto:** ${context}` : ""}

---

## Feature file gerado

\`\`\`gherkin
# language: pt

Funcionalidade: ${feature}
  Como ${role}
  Quero [ação principal derivada dos critérios]
  Para [benefício esperado]

  Contexto:
    Dado que o sistema está operacional
    E o banco de dados está em estado limpo

  # ── Happy path ──────────────────────────────────────────────────────────────

  Cenário: [Nome descritivo do cenário positivo principal]
    Dado [pré-condição do estado inicial]
    E [pré-condição adicional, se necessária]
    Quando [ação realizada pelo ator]
    Então [resultado observável esperado]
    E [resultado adicional, se aplicável]

  # ── Cenários negativos ───────────────────────────────────────────────────────

  Cenário: Dados inválidos são rejeitados com mensagem clara
    Dado [pré-condição]
    Quando [ação com dado inválido]
    Então a resposta deve ter status 400
    E a mensagem de erro deve indicar o campo inválido

  Cenário: Operação sem autenticação é rejeitada
    Dado que o usuário não está autenticado
    Quando [ação que requer autenticação]
    Então a resposta deve ter status 401
    E a mensagem deve indicar autenticação necessária

  Cenário: Acesso não autorizado é rejeitado
    Dado que o usuário está autenticado sem permissão para [recurso]
    Quando [ação que requer permissão específica]
    Então a resposta deve ter status 403

  # ── Edge cases ───────────────────────────────────────────────────────────────

  Esquema do cenário: Validação de limites de campo
    Dado [pré-condição]
    Quando o campo "<campo>" é preenchido com "<valor>"
    Então o resultado deve ser "<resultado>"

    Exemplos:
      | campo  | valor                | resultado       |
      | nome   | A                    | aceito (1 char) |
      | nome   | [string 255 chars]   | aceito (máximo) |
      | nome   | [string 256 chars]   | rejeitado       |
      | nome   |                      | rejeitado       |
      | nome   | <script>alert(1)</script> | rejeitado  |

  Cenário: Operação concorrente não causa duplicidade
    Dado [pré-condição]
    Quando a operação é enviada simultaneamente duas vezes
    Então apenas uma deve ser processada com sucesso
    E a segunda deve retornar erro de conflito ou resultado idempotente

  Cenário: Serviço dependente indisponível
    Dado que [serviço externo] está indisponível
    Quando [ação que depende do serviço]
    Então o sistema deve retornar erro com mensagem clara
    E não deve persistir dados parciais

  # ── Não funcionais ───────────────────────────────────────────────────────────

  Cenário: Resposta dentro do SLA definido
    Dado uma carga de [N] requisições simultâneas
    Quando [ação principal]
    Então o percentil 95 de latência deve ser menor que [X ms]
    E a taxa de erro deve ser menor que 1%
\`\`\`

---

## Checklist dos cenários

- [ ] Happy path cobre o fluxo completo de ponta a ponta
- [ ] Cada critério de aceitação mapeado para pelo menos um cenário
- [ ] Cenários negativos cobrem: entrada inválida, sem auth, sem permissão
- [ ] Edge cases incluem: boundary, caracteres especiais, concorrência, serviço indisponível
- [ ] Exemplos em Esquema do Cenário são representativos e não redundantes
- [ ] Passos Given/When/Then são independentes de implementação
- [ ] Linguagem de negócio — sem detalhes técnicos nos passos (sem SQL, sem classe, sem URL)
- [ ] Cada cenário testa exatamente um comportamento

---

## Step definitions recomendadas

Organize as step definitions em grupos:
- \`auth-steps\` — autenticação e sessão
- \`data-steps\` — setup e limpeza de dados
- \`api-steps\` — chamadas HTTP e verificações de resposta
- \`ui-steps\` — interações de interface (se E2E)

Use fixtures e builders para dados de teste reutilizáveis. Evite \`sleep\`; aguarde condições observáveis.

---

Agora implemente os cenários concretos para **${feature}** com base nos critérios fornecidos.`;
}

function designContractTests(args: Record<string, unknown>): string {
  const consumer = str(args.consumer);
  const provider = str(args.provider);
  const interactions = str(args.interactions);
  const stack = optStr(args.tech_stack);
  const brokerUrl = optStr(args.pact_broker_url);

  return `# Testes de Contrato — ${consumer} ↔ ${provider}

## Entrada recebida
- **Consumer:** ${consumer}
- **Provider:** ${provider}
- **Interações:** ${interactions}
${stack ? `- **Stack:** ${stack}` : ""}
${brokerUrl ? `- **Pact Broker:** ${brokerUrl}` : ""}

---

## Fluxo Consumer-Driven Contracts (CDC)

\`\`\`
[Consumer] define expectativas → gera contrato (.json)
     ↓
[Pact Broker] armazena e versiona contratos
     ↓
[Provider CI] valida contrato em estado controlado
     ↓
[can-i-deploy] bloqueia deploy incompatível
\`\`\`

---

## Interações a contratar

Para cada interação identificada abaixo, implemente:

### Estrutura de interação Pact

\`\`\`typescript
// Consumer side — ${stack?.includes("Java") ? "Java" : "TypeScript/Jest"}
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
const { like, eachLike, string, integer, regex, iso8601DateTime } = MatchersV3;

describe("${consumer} → ${provider}", () => {
  const provider = new PactV3({
    consumer: "${consumer}",
    provider: "${provider}",
    dir: "./pacts",
    // logLevel: "warn",
  });

  describe("[Nome da interação]", () => {
    it("deve retornar [resultado esperado] quando [condição]", async () => {
      await provider
        .given("[provider state — ex.: usuário 123 existe e está ativo]")
        .uponReceiving("[descrição legível da requisição]")
        .withRequest({
          method: "GET",              // método HTTP
          path: "/recurso/123",       // path exato
          // query: { page: "1" },   // query params se aplicável
          headers: {
            Accept: "application/json",
            // Authorization: like("Bearer token"),
          },
        })
        .willRespondWith({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: {
            id: integer(123),
            // Use matchers, não valores literais frágeis:
            name: like("João Silva"),
            email: regex(/^[^@]+@[^@]+\.[^@]+$/, "joao@example.com"),
            createdAt: iso8601DateTime(),
            // Campos opcionais: documente separadamente
          },
        })
        .executeTest(async (mockServer) => {
          // Chame o client real apontando para mockServer.url
          const client = new ${consumer}Client(mockServer.url);
          const result = await client.getById(123);
          expect(result.id).toBe(123);
        });
    });
  });
});
\`\`\`

---

## Provider states necessários

Para cada estado que o provider deve suportar:

\`\`\`typescript
// Provider side — verificação
import { Verifier } from "@pact-foundation/pact";

describe("${provider} — verificação de contratos", () => {
  it("deve honrar todos os contratos publicados", async () => {
    await new Verifier({
      provider: "${provider}",
      providerBaseUrl: "http://localhost:3000",
      ${brokerUrl ? `pactBrokerUrl: "${brokerUrl}",\n      publishVerificationResult: true,\n      providerVersion: process.env.VERSION,` : `// pactBrokerUrl: "http://pact-broker:9292",\n      // ou local:\n      pactUrls: ["./pacts/${consumer.replace(/\s/g, "_")}-${provider.replace(/\s/g, "_")}.json"],`}
      stateHandlers: {
        // Cada provider state declarado pelo consumer:
        "[nome do estado]": async () => {
          // Setup: inserir dados no banco de teste
          // Retornar objeto com dados criados se necessário
        },
        "no state": async () => {
          // Cleanup: banco vazio ou estado padrão
        },
      },
    }).verifyProvider();
  });
});
\`\`\`

---

## Cenários de contrato a implementar

### Cenários obrigatórios
| Cenário | Provider State | Status | Body |
|---------|---------------|--------|------|
| Recurso encontrado | Recurso existe | 200 | Schema completo com matchers |
| Recurso não encontrado | Recurso não existe | 404 | \`{ error: string }\` |
| Não autenticado | Qualquer | 401 | \`{ error: string }\` |
| Token expirado | Token expirado | 401 | \`{ error: string, code: "TOKEN_EXPIRED" }\` |
| Dados inválidos (POST/PUT) | Qualquer | 422 | \`{ errors: [{ field, message }] }\` |

### Matchers recomendados
- \`like()\` — tipo e estrutura, ignora valor exato
- \`integer()\` — número inteiro
- \`decimal()\` — número decimal
- \`string()\` — qualquer string não vazia
- \`iso8601DateTime()\` — datas
- \`regex()\` — formato específico (email, UUID, etc.)
- \`eachLike()\` — array com ao menos um item do schema
- \`atLeastOneLike()\` — array com N itens mínimos

---

## Versionamento e compatibilidade

\`\`\`bash
# Verificar se versão é safe para deploy
npx pact-broker can-i-deploy \\
  --pacticipant ${consumer} \\
  --version \${GIT_SHA} \\
  --to-environment production \\
  --broker-base-url ${brokerUrl ?? "http://pact-broker:9292"}
\`\`\`

### Política de evolução
- **Campos novos opcionais:** compatível — provider adiciona, consumer ignora
- **Campos removidos:** incompatível — detectado automaticamente
- **Renomeação:** breaking change — versionar API ou usar alias
- **Mudança de tipo:** incompatível — detectado automaticamente

---

## Integração CI/CD

\`\`\`yaml
# Consumer: gera e publica contratos
- name: Testes de contrato (consumer)
  run: |
    npm test -- --testPathPattern=pact
    npx pact-broker publish ./pacts \\
      --consumer-app-version \${{ github.sha }} \\
      --broker-base-url \${{ secrets.PACT_BROKER_URL }}

# Provider: verifica contratos antes do deploy
- name: Verificação de contratos (provider)
  run: npm run test:pact:provider
  env:
    PACT_BROKER_URL: \${{ secrets.PACT_BROKER_URL }}
    VERSION: \${{ github.sha }}

# Gate de deploy
- name: Can I deploy?
  run: |
    npx pact-broker can-i-deploy \\
      --pacticipant ${provider} \\
      --version \${{ github.sha }} \\
      --to-environment production
\`\`\`

---

Implemente agora os contratos concretos para as interações: **${interactions}**`;
}

function designIntegrationTests(args: Record<string, unknown>): string {
  const compA = str(args.component_a);
  const compB = str(args.component_b);
  const type = optStr(args.integration_type) ?? "não especificado";
  const stack = optStr(args.tech_stack);
  const scenarios = optStr(args.scenarios);

  const typeGuide: Record<string, string> = {
    database: "Use Testcontainers com o banco de produção. Nunca H2 se há queries específicas de engine, transactions, locks, tipos customizados ou migrations complexas.",
    "rest-api": "Mock com WireMock (Java), Nock/MSW (JS), responses (Python). Valide retry, timeout, circuit breaker e respostas de erro.",
    "message-queue": "Use embedded broker (EmbeddedKafka, RabbitMQ via Testcontainers). Valide schema, ordering, ack/nack, retry e dead-letter.",
    cache: "Use Redis via Testcontainers. Valide hit, miss, expiração, invalidação e fallback quando cache está indisponível.",
    "file-system": "Use diretórios temporários isolados por teste. Valide permissões, arquivos grandes, nomes especiais e limpeza.",
    "external-service": "Mock via WireMock. Valide sucesso, 4xx, 5xx, timeout, payload inválido e retry.",
    "service-to-service": "Combine WireMock para dependências externas com banco real via Testcontainers para o serviço sob teste.",
  };

  const guide = type !== "não especificado" ? typeGuide[type] : null;

  return `# Testes de Integração — ${compA} ↔ ${compB}

## Entrada recebida
- **Componente A:** ${compA}
- **Componente B:** ${compB}
- **Tipo:** ${type}
${stack ? `- **Stack:** ${stack}` : ""}
${scenarios ? `- **Cenários:** ${scenarios}` : ""}
${guide ? `\n> **Guia para tipo '${type}':** ${guide}` : ""}

---

## 1. Estratégia de isolamento

| Abordagem | Quando usar | Ferramentas |
|-----------|-------------|-------------|
| Container real (Testcontainers) | Banco, Redis, Kafka, RabbitMQ | Testcontainers, Docker |
| Mock determinístico | APIs externas, serviços de terceiros | WireMock, Nock, MSW |
| Embedded | Kafka em testes rápidos, H2 para queries simples | EmbeddedKafka, H2 |
| Spy/Stub interno | Módulos internos com efeito colateral | Jest mock, Mockito |

**Princípio:** Não mocke o que você está testando. Mock apenas o que está fora do escopo do teste.

---

## 2. Estrutura de teste recomendada

\`\`\`typescript
// Exemplo em TypeScript + Jest + Testcontainers
import { GenericContainer, StartedTestContainer } from "testcontainers";

describe("${compA} ↔ ${compB} — integração", () => {
  let container: StartedTestContainer;
  // let db: DatabaseConnection | undefined;

  // Setup uma vez por suíte (container reutilizado entre testes)
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_DB: "testdb", POSTGRES_USER: "test", POSTGRES_PASSWORD: "test" })
      .withExposedPorts(5432)
      .start();

    // Configurar connection pool, rodar migrations
    // db = await connectDatabase(container.getMappedPort(5432));
    // await runMigrations(db);
  }, 60_000);

  afterAll(async () => {
    await container.stop();
  });

  // Limpar estado entre testes (mais rápido que recriar container)
  beforeEach(async () => {
    // await db.query("TRUNCATE TABLE orders, users CASCADE");
    // ou: await db.query("BEGIN") + afterEach rollback
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("deve [resultado esperado] quando [condição válida]", async () => {
    // Arrange
    // const user = await createTestUser(db);

    // Act
    // const result = await ${compA.toLowerCase().replace(/\s/g, "")}Service.doOperation(user.id);

    // Assert
    // expect(result.status).toBe("success");
    // expect(result.id).toBeDefined();
    // const persisted = await db.query("SELECT * FROM ...");
    // expect(persisted.rows).toHaveLength(1);
  });

  // ── Cenários de erro ────────────────────────────────────────────────────────

  it("deve lançar erro quando recurso não existe", async () => {
    // await expect(service.getById("non-existent-id")).rejects.toThrow(NotFoundError);
  });

  it("deve fazer rollback em falha de persistência", async () => {
    // Arrange: forçar falha na segunda operação
    // Assert: nenhum dado deve ter sido persistido
  });

  // ── Concorrência ────────────────────────────────────────────────────────────

  it("deve manter consistência sob operações concorrentes", async () => {
    const operations = Array.from({ length: 10 }, () =>
      // service.concurrentOperation()
      Promise.resolve()
    );

    const results = await Promise.allSettled(operations);
    const successful = results.filter((r) => r.status === "fulfilled");
    // expect(successful).toHaveLength(1); // somente uma deve vencer
  });

  // ── Timeout e retry ─────────────────────────────────────────────────────────

  it("deve retentar N vezes antes de falhar", async () => {
    // Arrange: mock retorna erro nas primeiras N-1 chamadas
    // Assert: serviço retenta e sucede na última; ou falha após esgotar retries
  });
});
\`\`\`

---

## 3. Cenários obrigatórios

### Happy path
- [ ] Operação com dados válidos retorna resultado esperado
- [ ] Dados são persistidos/transmitidos corretamente
- [ ] Efeitos colaterais esperados ocorrem (evento publicado, email enviado, cache populado)

### Cenários de erro
- [ ] Recurso não encontrado → erro apropriado (404/NotFound)
- [ ] Dados inválidos → erro de validação com campo indicado
- [ ] ${compB} indisponível → comportamento definido (fallback, erro limpo, retry)
- [ ] Falha parcial → rollback completo, sem estado inconsistente

### Boundary e edge cases
- [ ] Operação com dataset vazio
- [ ] Operação com volume máximo permitido
- [ ] Caracteres especiais em campos de texto
- [ ] Fuso horário e formatos de data

### Concorrência e idempotência
- [ ] Operação idempotente: segunda chamada com mesmo payload não cria duplicata
- [ ] Operação concorrente: apenas um vence sem corrupção de estado
- [ ] Lock: operação bloqueada enquanto outra está em andamento

---

## 4. Gerenciamento de dados de teste

\`\`\`typescript
// Builder pattern para dados de teste legíveis
class UserTestBuilder {
  private user = { name: "Test User", email: "test@example.com", role: "user" };

  withName(name: string) { this.user.name = name; return this; }
  withEmail(email: string) { this.user.email = email; return this; }
  withRole(role: string) { this.user.role = role; return this; }
  build() { return { ...this.user }; }
}

// Uso nos testes:
// const user = new UserTestBuilder().withRole("admin").build();
\`\`\`

**Princípios:**
- Cada teste cria seus próprios dados — nunca dependa de dados de outro teste
- Use \`beforeEach\` para truncate ou transação com rollback
- Builders e factories centralizados em \`test/fixtures/\`

---

## 5. Awaiting assíncrono corretamente

\`\`\`typescript
import { waitFor } from "@testing-library/dom"; // ou implementação própria

// ❌ Nunca:
// await new Promise(r => setTimeout(r, 5000));

// ✅ Sempre espere condição observável:
await waitFor(
  async () => {
    const result = await checkCondition();
    expect(result).toBe(true);
  },
  { timeout: 10_000, interval: 200 }
);
\`\`\`

---

## 6. Observabilidade nos testes

Valide que, além do comportamento, os seguintes artefatos de observabilidade são emitidos:
- [ ] Log de sucesso contém correlationId e campos obrigatórios
- [ ] Log de erro contém stack trace e contexto suficiente para debug
- [ ] Métricas de latência são registradas
- [ ] Span de tracing é criado com atributos corretos

---

Implemente agora os testes de integração para **${compA} ↔ ${compB}** cobrindo os cenários acima.`;
}

function generatePerformancePlan(args: Record<string, unknown>): string {
  const target = str(args.target);
  const load = optStr(args.expected_load) ?? "não definida";
  const sla = optStr(args.sla) ?? "p95 < 500ms, taxa de erro < 1%";
  const testTypes = (() => {
    if (!Array.isArray(args.test_types) || args.test_types.length === 0) {
      return ["smoke", "load", "stress", "spike", "soak"];
    }
    const valid = (args.test_types as unknown[]).filter(
      (t): t is string => typeof t === "string" && VALID_PERF_TYPES.has(t)
    );
    return valid.length > 0 ? valid : ["smoke", "load", "stress", "spike", "soak"];
  })();

  return `# Plano de Performance — ${target}

## Entrada recebida
- **Alvo:** ${target}
- **Carga esperada:** ${load}
- **SLA:** ${sla}
- **Tipos de teste:** ${testTypes.join(", ")}

---

## 1. Cenários de teste

| Tipo | Objetivo | VUs | Duração | Thresholds |
|------|----------|-----|---------|------------|
| **Smoke** | Validar funcionamento básico | 1 | 30s | p95 < 1s, erros = 0 |
| **Load** | Comportamento na carga nominal | N (carga esperada) | 5-15min | ${sla} |
| **Stress** | Encontrar ponto de quebra | Ramp até 10x carga | 20min | Observar degradação |
| **Spike** | Resiliência a picos súbitos | 0 → 10x → 0 em segundos | 10min | Recovery time |
| **Soak** | Vazamentos de memória/recurso | Carga nominal | 1-4h | Estabilidade ao longo do tempo |

---

## 2. Script k6 — template completo

\`\`\`javascript
// k6 run --env BASE_URL=https://api.example.com k6-plan.js
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Métricas customizadas
const errorRate = new Rate("error_rate");
const businessLatency = new Trend("business_latency", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || "50");

export const options = {
  scenarios: {
${testTypes.includes("smoke") ? `    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      tags: { scenario: "smoke" },
    },` : ""}
${testTypes.includes("load") ? `    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: TARGET_VUS },      // ramp-up
        { duration: "5m", target: TARGET_VUS },      // sustentação
        { duration: "2m", target: 0 },               // ramp-down
      ],
      tags: { scenario: "load" },
    },` : ""}
${testTypes.includes("stress") ? `    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: TARGET_VUS },
        { duration: "2m", target: TARGET_VUS * 2 },
        { duration: "2m", target: TARGET_VUS * 4 },
        { duration: "2m", target: TARGET_VUS * 8 },
        { duration: "2m", target: 0 },
      ],
      tags: { scenario: "stress" },
    },` : ""}
${testTypes.includes("spike") ? `    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: TARGET_VUS },
        { duration: "1m", target: TARGET_VUS },
        { duration: "10s", target: TARGET_VUS * 10 }, // spike
        { duration: "3m", target: TARGET_VUS * 10 },
        { duration: "10s", target: TARGET_VUS },     // recovery
        { duration: "3m", target: TARGET_VUS },
        { duration: "10s", target: 0 },
      ],
      tags: { scenario: "spike" },
    },` : ""}
${testTypes.includes("soak") ? `    soak: {
      executor: "constant-vus",
      vus: Math.floor(TARGET_VUS * 0.6),
      duration: "1h",
      tags: { scenario: "soak" },
    },` : ""}
  },
  thresholds: {
    // Thresholds globais — derivados do SLA: ${sla}
    http_req_duration: ["p(95)<500", "p(99)<2000"],
    http_req_failed: ["rate<0.01"],
    error_rate: ["rate<0.01"],

    // Thresholds por cenário
    "http_req_duration{scenario:smoke}": ["p(95)<1000"],
    "http_req_duration{scenario:load}": ["p(95)<500"],
  },
};

// Dados de teste realistas
const TEST_PAYLOADS = [
  { name: "payload_valido_1" /* ... campos reais */ },
  { name: "payload_valido_2" },
];

export default function () {
  const payload = TEST_PAYLOADS[Math.floor(Math.random() * TEST_PAYLOADS.length)];

  group("${target}", () => {
    const start = Date.now();

    // Substitua pela requisição real:
    const response = http.get(\`\${BASE_URL}/endpoint\`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${__ENV.API_TOKEN || "test-token"}\`,
      },
      tags: { name: "${target}" },
    });

    businessLatency.add(Date.now() - start);

    const ok = check(response, {
      "status é 200": (r) => r.status === 200,
      "body não está vazio": (r) => r.body !== null && r.body.length > 0,
      "latência aceitável": (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);

    sleep(Math.random() * 1 + 0.5); // think time realista: 0.5-1.5s
  });
}

export function handleSummary(data) {
  return {
    "resultado-k6.html": htmlReport(data),
    stdout: JSON.stringify(data.metrics, null, 2),
  };
}
\`\`\`

---

## 3. Comandos de execução

\`\`\`bash
# Instalar k6 (Windows)
winget install GrafanaLabs.k6

# Instalar k6 (macOS)
brew install k6

# Smoke test rápido
k6 run --env BASE_URL=https://staging.example.com k6-plan.js

# Load test com VUs customizados
k6 run --env BASE_URL=https://staging.example.com --env TARGET_VUS=100 k6-plan.js

# Apenas um cenário
k6 run --scenario load k6-plan.js

# Com output Grafana Cloud
k6 run --out cloud k6-plan.js
\`\`\`

---

## 4. Métricas a monitorar durante o teste

| Métrica | Significado | Alerta se |
|---------|-------------|-----------|
| \`http_req_duration{p(95)}\` | Latência do percentil 95 | > ${sla.split(",")[0]?.split("<")[1]?.trim() ?? "500ms"} |
| \`http_req_failed\` | Taxa de requisições com erro | > 1% |
| \`http_req_rate\` | Throughput (req/s) | Queda inesperada durante sustentação |
| \`vus\` | VUs ativos | Não sobe como esperado = problema de init |
| CPU do servidor | Uso de CPU | > 80% sustentado |
| Memória | Uso de memória | Crescimento contínuo durante soak |
| Conexões ativas | Pool de banco | Próximo ao limite |
| GC pause (JVM/Node) | Garbage collection | Pausas > 100ms frequentes |

---

## 5. Análise de resultados

Analise na seguinte ordem:
1. **Thresholds passaram?** — Verifica SLA básico
2. **Curva de latência por VU** — Identifica ponto de saturação (joelho da curva)
3. **Taxa de erro por cenário** — Smoke deve ter 0%; load < 1%
4. **Distribuição de status codes** — 5xx indica erro de servidor; 429 indica rate limit
5. **Métricas de servidor** — Correlacione latência com CPU/memória/conexões
6. **Soak trend** — Crescimento linear de memória = memory leak

---

Execute o script acima contra o ambiente de staging com dados representativos de produção.`;
}

function securityTestChecklist(args: Record<string, unknown>): string {
  const featureType = optStr(args.feature_type) ?? "api-public";
  const context = optStr(args.context);
  const stack = optStr(args.tech_stack);

  const checklists: Record<string, string[]> = {
    authentication: [
      "Brute force: limite de tentativas com lockout ou CAPTCHA",
      "Credential stuffing: detecção de credenciais conhecidas (HaveIBeenPwned API)",
      "Password reset: token de uso único, expiração ≤ 15min, não reutilizável",
      "Password reset: link não deve revelar se email existe (account enumeration)",
      "Session fixation: novo token de sessão após login bem-sucedido",
      "Session timeout: inativo > X min deve expirar e exigir novo login",
      "Logout: token/cookie invalidado no servidor (não apenas no cliente)",
      "MFA: bypass via fallback inseguro (SMS, backup codes triviais)",
      "Remember me: token persistente deve ser rotacionado após uso",
      "OAuth/OIDC: state parameter presente e validado (CSRF no fluxo OAuth)",
      "JWT: algoritmo 'none' deve ser rejeitado; validar iss, aud, exp",
      "Senhas: política mínima (length, complexidade); não armazenar em texto plano",
      "Headers: HTTPS obrigatório; HSTS habilitado",
    ],
    authorization: [
      "BOLA/IDOR: usuário A não pode acessar recurso do usuário B via ID direto",
      "Privilege escalation: usuário comum não pode acessar endpoint de admin",
      "Autorização horizontal: filtrar recursos pelo contexto do usuário autenticado",
      "Autorização vertical: roles e permissões granulares validadas no servidor",
      "Endpoints de administração: requerem role explícita, não apenas autenticação",
      "Deleção e edição: verificar ownership antes de permitir operação",
      "Bulk operations: verificar permissão para cada item, não apenas para a operação",
      "Referências diretas: nunca expor IDs internos sequenciais sem validação",
    ],
    payment: [
      "HTTPS em 100% do fluxo de checkout",
      "Dados de cartão: nunca persistir CVV; mascarar PAN nos logs",
      "Valor: validar no servidor, nunca confiar no valor enviado pelo cliente",
      "Race condition: implementar idempotency key para evitar double charge",
      "Refund: verificar se pedido pertence ao usuário e está em estado válido",
      "Webhook de pagamento: validar assinatura do provider (Stripe-Signature, etc.)",
      "PCI-DSS: usar provedor certificado (Stripe, Adyen); não processar raw card data",
      "Log: mascarar completamente dados de cartão; não logar tokens de pagamento",
      "Estorno: limite de valor; verificar se não foi estornado anteriormente",
    ],
    "file-upload": [
      "MIME type: validar no servidor (não confiar no Content-Type do cliente)",
      "Extensão: whitelist de extensões permitidas; bloquear .php, .js, .exe",
      "Conteúdo: usar biblioteca de análise de conteúdo real (ex.: libmagic, file-type)",
      "Tamanho: limite máximo; rejeitar antes de processar para evitar DoS",
      "Path traversal: sanitizar nome do arquivo antes de qualquer operação de I/O",
      "Execução: arquivos nunca devem ser servidos de diretório executável",
      "Storage: salvar fora do webroot ou em object storage (S3) isolado",
      "Antivírus: scan assíncrono após upload; quarentena antes de disponibilizar",
      "Metadados: remover EXIF/metadados com geolocalização antes de servir",
    ],
    "api-public": [
      "Rate limiting por IP e por chave de API",
      "Input validation: rejeitar campos desconhecidos (whitelist vs blacklist)",
      "Output: não expor campos internos (id de banco, tokens, senhas hasheadas)",
      "Erros: mensagens genéricas; não expor stack trace ou nome de classe",
      "SQL/NoSQL injection: parameterized queries em todas as queries",
      "CORS: origem restrita; não usar wildcard em APIs autenticadas",
      "Versioning: versões antigas desativadas com prazo; deprecation headers",
      "Paginação: sem cursor que exponha dados de outros usuários",
      "Mass assignment: whitelist de campos aceitos no body",
    ],
    "admin-panel": [
      "Acesso restrito a rede interna ou VPN",
      "MFA obrigatório para todos os usuários admin",
      "Auditoria completa: quem, o quê, quando, antes e depois de cada ação",
      "CSRF: token anti-CSRF em todas as ações destrutivas",
      "Sessão: timeout curto (< 15min inativo)",
      "Confirmação: ações irreversíveis exigem confirmação explícita + senha",
      "Privilege escalation: admin não pode elevar próprias permissões",
      "Export: dados exportados são sanitizados e auditados",
    ],
    "user-data": [
      "LGPD/GDPR: consentimento registrado com timestamp e escopo",
      "Right to erasure: deleção remove dados de todas as tabelas e backups (documentar SLA)",
      "Data portability: export em formato legível (JSON, CSV)",
      "Minimização: coletar apenas dados necessários para a finalidade",
      "Retenção: dados expiram automaticamente após período definido",
      "Criptografia em repouso: dados sensíveis (CPF, endereço) criptografados na coluna",
      "Compartilhamento: dados não enviados a terceiros sem consentimento",
      "Log: dados pessoais mascarados em todos os logs",
    ],
  };

  const items = checklists[featureType] ?? checklists["api-public"];

  return `# Checklist de Segurança — ${featureType}

## Entrada recebida
- **Tipo de feature:** ${featureType}
${context ? `- **Contexto:** ${context}` : ""}
${stack ? `- **Stack:** ${stack}` : ""}

---

## Checklist OWASP — ${featureType}

${items.map((item, i) => `- [ ] **${i + 1}.** ${item}`).join("\n")}

---

## OWASP Top 10 — verificação cruzada

| Categoria OWASP | Relevante? | Casos de teste |
|-----------------|-----------|----------------|
| A01 Broken Access Control | ✅ | IDOR, privilege escalation, CORS aberto |
| A02 Cryptographic Failures | ✅ | HTTPS, dados em repouso, tokens seguros |
| A03 Injection | ✅ | SQL, NoSQL, Command, SSTI, XSS |
| A04 Insecure Design | ✅ | Rate limit, lógica de negócio abusável |
| A05 Security Misconfiguration | ✅ | Headers, erros verbosos, debug ativo |
| A06 Vulnerable Components | ✅ | \`npm audit\`, Snyk, Dependabot |
| A07 Auth Failures | ✅ | Brute force, session, JWT |
| A08 Software Integrity Failures | ⚠️ | CI/CD pipeline, supply chain |
| A09 Logging Failures | ✅ | Dados sensíveis em log, auditoria |
| A10 SSRF | ⚠️ | Se aceita URLs externas como input |

---

## Headers de segurança obrigatórios

\`\`\`http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cache-Control: no-store  (para respostas com dados sensíveis)
\`\`\`

---

## Ferramentas recomendadas

| Categoria | Ferramenta | Uso |
|-----------|-----------|-----|
| SAST | SonarQube, Semgrep, CodeQL | CI em cada PR |
| DAST | OWASP ZAP, Nuclei | Staging pré-release |
| Dependências | \`npm audit\`, Snyk, OWASP DC | CI em cada PR |
| Secrets scan | TruffleHog, GitLeaks | CI em cada commit |
| Pentest manual | Burp Suite | Release major |
| Headers | SecurityHeaders.com | Review periódico |

---

## Critérios de aceitação de segurança

- [ ] Zero findings críticos antes do deploy em produção
- [ ] Findings altos resolvidos em ≤ 48h
- [ ] Findings médios em backlog com prazo ≤ 2 sprints
- [ ] \`npm audit\` sem vulnerabilidades críticas ou altas
- [ ] Headers de segurança todos presentes e corretos
- [ ] Dados sensíveis mascarados em todos os logs verificado
- [ ] DAST executado e relatório revisado

---

Execute este checklist como parte da Definition of Done da feature **${featureType}**.`;
}

function reviewTestCode(args: Record<string, unknown>): string {
  const code = str(args.code);
  const language = optStr(args.language) ?? "não especificado";
  const framework = optStr(args.framework) ?? "não especificado";
  const context = optStr(args.context);

  return `# Revisão de Código de Teste

## Entrada recebida
- **Linguagem:** ${language}
- **Framework:** ${framework}
${context ? `- **Contexto:** ${context}` : ""}
- **Código:** ${code.length} caracteres

---

## Framework de revisão

Analise o código fornecido em relação a cada categoria abaixo. Reporte findings em ordem de severidade: **Crítico → Alto → Médio → Baixo → Sugestão**.

---

## 1. Design e estrutura

| Critério | O que verificar |
|----------|----------------|
| **Nomenclatura** | Nome descreve comportamento? (should_X_when_Y vs test1) |
| **Responsabilidade única** | Cada teste verifica exatamente um comportamento? |
| **Arrange-Act-Assert** | Estrutura AAA clara e separada? |
| **Tamanho** | Teste muito longo = múltiplas responsabilidades |
| **Abstração** | Helpers e fixtures extraídos em funções reutilizáveis? |

---

## 2. Anti-patterns críticos

Identifique e classifique como **Crítico** se encontrado:

- [ ] **Testes acoplados:** um teste depende do estado deixado por outro
- [ ] **Dados compartilhados mutáveis:** variável global alterada entre testes
- [ ] **\`sleep\` fixo:** \`Thread.sleep()\`, \`await new Promise(r => setTimeout(r, N))\`
- [ ] **Assert sem mensagem em falha:** dificulta diagnóstico em CI
- [ ] **Teste que nunca falha:** assert trivial ou catch que engole exceção
- [ ] **Lógica condicional no teste:** if/else no corpo do teste = dois testes
- [ ] **Múltiplos behaviors em um teste:** mais de um "Quando" ou muitos "Então"

---

## 3. Isolamento e determinismo

| Critério | Anti-pattern |
|----------|-------------|
| Estado limpo | Setup/teardown ausente ou incompleto |
| Dados de teste | Dados hardcoded de produção, datas fixas como "2024-01-01" |
| Randomização | \`Math.random()\` sem seed no teste = resultado não reprodutível |
| Ordem de execução | Testes assumem ordem de execução específica |
| Recursos externos | HTTP real sem mock, banco real sem isolamento |

---

## 4. Qualidade de asserções

\`\`\`
✅ Boa asserção:    expect(user.email).toBe("joao@example.com")
✅ Boa asserção:    expect(response.status).toBe(201)
❌ Asserção fraca:  expect(result).toBeTruthy()
❌ Asserção fraca:  expect(items.length).toBeGreaterThan(0)
❌ Asserção fraca:  expect(error).toBeDefined()
\`\`\`

- [ ] Asserções são específicas (valor exato, não apenas truthy)
- [ ] Asserções cobrem o comportamento, não a implementação
- [ ] Todos os casos testados têm ao menos uma asserção relevante
- [ ] Mensagem de falha é clara (usar \`fail()\`, \`expect(..., "mensagem")\` quando necessário)

---

## 5. Mocks e stubs

| Critério | Problema | Solução |
|----------|---------|---------|
| Over-mocking | Mockar o que está sendo testado | Mocking é para dependências externas |
| Under-mocking | HTTP real em teste unitário | Usar interceptor, nock, WireMock |
| Mock sem verificação | Stub que não verifica chamada esperada | Adicionar \`expect(mock).toHaveBeenCalledWith()\` |
| Mock sempre bem-sucedido | Não testa caminho de falha | Adicionar cenários com mock retornando erro |

---

## 6. Performance da suíte

- [ ] Testes unitários > 100ms: investigar I/O ou cálculo pesado desnecessário
- [ ] Container criado por teste: mover para \`beforeAll\` e reutilizar
- [ ] \`beforeAll\` com setup pesado sem cache: pode ser movido para global setup
- [ ] Paralelismo: testes independentes devem rodar em paralelo

---

## 7. Legibilidade e manutenibilidade

\`\`\`typescript
// ❌ Difícil de manter
test("t1", () => {
  const u = new User(); u.n = "j"; u.e = "j@e.com";
  repo.save(u); const f = repo.find("j@e.com");
  expect(f).not.toBeNull();
});

// ✅ Claro e manutenível
it("deve encontrar usuário pelo email após persistência", () => {
  // Arrange
  const user = new UserBuilder().withEmail("joao@example.com").build();
  userRepository.save(user);

  // Act
  const found = userRepository.findByEmail("joao@example.com");

  // Assert
  expect(found).not.toBeNull();
  expect(found?.email).toBe("joao@example.com");
});
\`\`\`

---

## 8. Cobertura e gaps

- [ ] Happy path está coberto
- [ ] Todos os caminhos de erro estão cobertos
- [ ] Boundary values testados (mín, máx, mín-1, máx+1)
- [ ] Exceções e throws verificados
- [ ] Casos assíncronos aguardados corretamente (await, Promise)

---

## Formato de resposta esperado

Para cada finding, informe:
1. **Localização:** linha/função/teste afetado
2. **Severidade:** Crítico / Alto / Médio / Baixo / Sugestão
3. **Categoria:** Design / Anti-pattern / Isolamento / Asserção / Mock / Performance
4. **Problema:** Descrição do que está errado
5. **Solução:** Como corrigir com exemplo de código quando aplicável

---

Analise o código fornecido e liste todos os findings seguindo o framework acima.`;
}

function troubleshootFlakyTest(args: Record<string, unknown>): string {
  const description = str(args.description);
  const symptoms = str(args.symptoms);
  const framework = optStr(args.framework) ?? "não especificado";
  const code = optStr(args.code);

  return `# Diagnóstico de Teste Instável (Flaky)

## Entrada recebida
- **Teste:** ${description}
- **Sintomas:** ${symptoms}
- **Framework:** ${framework}
${code ? `- **Código:** fornecido (${code.length} chars)` : ""}

---

## 1. Hipóteses por probabilidade

Analise os sintomas e classifique cada hipótese como **Alta / Média / Baixa** probabilidade:

### Timing e assincronia (probabilidade geralmente Alta)
- [ ] **Await incorreto:** Promise não aguardada; race condition entre test e assertion
- [ ] **Sleep fixo:** timeout hardcoded menor que a operação em ambiente lento (CI vs local)
- [ ] **Event listener:** listener registrado mas evento disparado antes do assert
- [ ] **Animação CSS:** elemento presente no DOM mas não visível/clicável ainda
- [ ] **API assíncrona:** resposta chega depois do assert

### Compartilhamento de estado (probabilidade Alta em suítes paralelas)
- [ ] **Banco compartilhado:** dados de um teste afetam outro
- [ ] **Variável global:** estado mutado entre testes sem reset
- [ ] **Singleton com cache:** retorna dado de execução anterior
- [ ] **Arquivo temporário:** conflito de nome entre execuções paralelas
- [ ] **Porta de rede:** porta fixa em conflito quando paralelo

### Dependências externas (probabilidade Média)
- [ ] **API externa real:** latência variável, rate limit, downtime intermitente
- [ ] **Relógio do sistema:** teste depende de hora/data específica
- [ ] **Fuso horário:** diferente entre local e CI
- [ ] **Ordem de registros no banco:** ORDER BY ausente em query de verificação
- [ ] **Seed aleatório:** dados gerados randomicamente sem seed fixo

### Ambiente (probabilidade Média/Baixa)
- [ ] **Recursos do CI:** CPU/memória limitados causam timeouts
- [ ] **Versão de dependência:** \`@latest\` resolve versões diferentes
- [ ] **Variável de ambiente ausente:** comportamento padrão diferente
- [ ] **Permissões de arquivo:** diferentes entre SO/usuário
- [ ] **Locale:** formatação de número/data diferente

### Problemas de teste em si (probabilidade Baixa mas importante)
- [ ] **Assert frágil:** verifica timestamp, UUID, ou ordem não garantida
- [ ] **Cleanup incompleto:** afterEach não executa em falha anterior
- [ ] **Loop com async:** \`forEach\` com async sem await adequado

---

## 2. Passos de diagnóstico

### Passo 1 — Reproduzir localmente
\`\`\`bash
# Executar o teste em loop para confirmar flakiness
for i in {1..20}; do npm test -- --testNamePattern="[nome do teste]" 2>&1 | tail -5; done

# Ou com Jest
jest --testNamePattern="[nome]" --runInBand --forceExit --verbose
\`\`\`

### Passo 2 — Isolar o ambiente
\`\`\`bash
# Rodar em modo serial (elimina paralelo como causa)
jest --runInBand

# Rodar apenas o arquivo do teste com log detalhado
jest path/to/test.spec.ts --verbose --detectOpenHandles
\`\`\`

### Passo 3 — Adicionar observabilidade
\`\`\`typescript
// Adicionar logs antes e depois da ação suspeita
console.log("[DIAG] Estado antes:", JSON.stringify(state));
await action();
console.log("[DIAG] Estado depois:", JSON.stringify(state));

// Capturar screenshot em falha (Playwright/Cypress)
afterEach(async () => {
  if (currentTestFailed()) {
    await page.screenshot({ path: \`screenshots/\${testName}-\${Date.now()}.png\` });
  }
});
\`\`\`

### Passo 4 — Verificar isolamento
\`\`\`typescript
// Confirmar que cada teste começa com estado limpo
beforeEach(async () => {
  console.log("[DIAG] Iniciando com estado:", await getDbRowCount());
  await cleanDatabase();
});
afterEach(async () => {
  console.log("[DIAG] Finalizando com estado:", await getDbRowCount());
});
\`\`\`

---

## 3. Correções por causa raiz

### Timing → await por condição
\`\`\`typescript
// ❌ Causa flakiness:
await page.click("#submit");
await new Promise(r => setTimeout(r, 2000));
expect(await page.textContent("#result")).toBe("Sucesso");

// ✅ Aguardar condição observável:
await page.click("#submit");
await page.waitForSelector("#result:has-text('Sucesso')", { timeout: 10_000 });
// ou com polling:
await expect(page.locator("#result")).toHaveText("Sucesso", { timeout: 10_000 });
\`\`\`

### Estado compartilhado → isolamento por transação
\`\`\`typescript
// ✅ Rollback após cada teste (mais rápido que truncate):
let transaction: Transaction;
beforeEach(async () => { transaction = await db.beginTransaction(); });
afterEach(async () => { await transaction.rollback(); });
\`\`\`

### Ordem de resultado não garantida
\`\`\`typescript
// ❌ Falha se ordem mudar:
expect(results[0].name).toBe("Alice");

// ✅ Ordenar explicitamente antes de assertar:
const sorted = results.sort((a, b) => a.name.localeCompare(b.name));
expect(sorted[0].name).toBe("Alice");
\`\`\`

### Porta em conflito (paralelo)
\`\`\`typescript
// ✅ Usar porta 0 para SO escolher livre automaticamente:
const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
\`\`\`

---

## 4. Estratégia de prevenção

| Prática | Implementação |
|---------|--------------|
| Quarentena temporária | Tag flaky, mover para suíte separada, criar issue com prazo |
| Retry limitado | Máximo 2 retries SOMENTE para falhas de infra (não de lógica) |
| Observabilidade | Screenshot, vídeo, trace em falha automático |
| Análise de tendência | Registrar taxa de sucesso por teste ao longo do tempo |
| Penalidade de flakiness | Teste com > 5% de flakiness deve ser corrigido ou removido no sprint |
| Code review de testes | Checklist de flakiness em PRs com testes novos |

---

## 5. Política de flaky tests

1. **Detectado:** criar issue com evidência (log, taxa de falha, ambiente)
2. **Quarentena:** mover para tag \`@flaky\` e excluir do gate de PR imediatamente
3. **Triagem (< 2 dias):** identificar causa raiz com o diagnóstico acima
4. **Correção (≤ 1 sprint):** corrigir e validar com 50 execuções consecutivas
5. **Reintegração:** remover tag \`@flaky\` após validação
6. **Remoção:** teste que não for corrigido em 1 sprint deve ser removido

---

Aplique o diagnóstico acima ao teste: **${description}** com sintomas: **${symptoms}**`;
}

function generateCiPipeline(args: Record<string, unknown>): string {
  const stack = optStr(args.tech_stack) ?? "Node.js";
  const rawCiTypes = Array.isArray(args.test_types) ? (args.test_types as unknown[]) : [];
  const testTypes = rawCiTypes.filter((t): t is string => typeof t === "string" && VALID_CI_TEST_TYPES.has(t));
  const platform =
    typeof args.platform === "string" && VALID_PLATFORMS.has(args.platform)
      ? args.platform
      : "github-actions";
  const rawCoverage = typeof args.coverage_target === "number" ? args.coverage_target : 80;
  const coverage = Math.max(0, Math.min(100, Math.round(rawCoverage)));
  const context = optStr(args.context);

  const isNode = stack.toLowerCase().includes("node") || stack.toLowerCase().includes("typescript") || stack.toLowerCase().includes("javascript");
  const isJava = stack.toLowerCase().includes("java") || stack.toLowerCase().includes("spring");
  const isPython = stack.toLowerCase().includes("python");

  const installCmd = isJava ? "mvn dependency:resolve" : isPython ? "pip install -r requirements.txt" : "npm ci";
  const unitCmd = isJava ? "mvn test -Dtest='*UnitTest'" : isPython ? "pytest tests/unit/ -x" : "npm run test:unit -- --coverage";
  const contractCmd = isJava ? "mvn test -Dtest='*ContractTest'" : "npm run test:contract";
  const integrationCmd = isJava ? "mvn test -Dtest='*IntegrationTest'" : isPython ? "pytest tests/integration/" : "npm run test:integration";
  const e2eCmd = "npm run test:e2e";

  return `# Pipeline CI/CD — ${platform}

## Entrada recebida
- **Stack:** ${stack}
- **Tipos de teste:** ${testTypes.join(", ")}
- **Plataforma:** ${platform}
- **Cobertura mínima:** ${coverage}%
${context ? `- **Contexto:** ${context}` : ""}

---

## Arquitetura do pipeline

\`\`\`
PR aberto/atualizado:
  └─ [1] quality-gate    (lint, typecheck, unitários + cobertura)   <2min
  └─ [2] contract-tests  (Pact consumer + publicação)               paralelo com [3]
  └─ [3] integration     (Testcontainers, WireMock)                 paralelo com [2]

Merge na main:
  └─ [4] build + push de imagem Docker
  └─ [5] e2e-smoke       (smoke em staging)                         <5min

Release/agendado:
  └─ [6] e2e-regression  (suíte completa em staging)                <30min
  └─ [7] performance     (k6 load test)
  └─ [8] security-scan   (DAST + dependências)
\`\`\`

---

## Configuração GitHub Actions

\`\`\`yaml
# .github/workflows/ci.yml
name: CI — QA Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: "20"
  COVERAGE_THRESHOLD: "${coverage}"

jobs:
  # ── Stage 1: Quality Gate ──────────────────────────────────────────────────
  quality-gate:
    name: "Lint + Typecheck + Unit Tests"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup ${isJava ? "Java" : isNode ? "Node.js" : "Python"}
        uses: ${isJava ? "actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: 21" : isNode ? "actions/setup-node@v4\n        with:\n          node-version: ${{ env.NODE_VERSION }}\n          cache: npm" : "actions/setup-python@v5\n        with:\n          python-version: 3.12"}

      - name: Instalar dependências
        run: ${installCmd}

      - name: Lint
        run: ${isJava ? "mvn checkstyle:check" : isPython ? "ruff check . && mypy ." : "npm run lint"}

      - name: Typecheck
        run: ${isJava ? "echo 'Typecheck handled by compiler'" : isPython ? "mypy ." : "npm run typecheck"}

      - name: Testes unitários + cobertura
        run: ${unitCmd}

      - name: Verificar cobertura mínima
        run: |
          ${isNode ? `COVERAGE=$(node -e "const r=require('./coverage/coverage-summary.json'); console.log(r.total.lines.pct)")
          echo "Cobertura: $COVERAGE%"
          node -e "if(parseFloat('$COVERAGE') < ${coverage}) { console.error('Cobertura abaixo de ${coverage}%'); process.exit(1); }"` : "echo 'Verificar cobertura configurada no framework'"}

      - name: Upload cobertura
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
${testTypes.includes("contract") ? `
  # ── Stage 2: Testes de Contrato ───────────────────────────────────────────
  contract-tests:
    name: "Contract Tests (Pact)"
    runs-on: ubuntu-latest
    needs: quality-gate
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Testes de contrato (consumer)
        run: ${contractCmd}
        env:
          PACT_BROKER_URL: \${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: \${{ secrets.PACT_BROKER_TOKEN }}
      - name: Publicar contratos
        run: |
          npx pact-broker publish ./pacts \\
            --consumer-app-version \${{ github.sha }} \\
            --broker-base-url \${{ secrets.PACT_BROKER_URL }} \\
            --broker-token \${{ secrets.PACT_BROKER_TOKEN }}
        if: github.event_name == 'push'
` : ""}
${testTypes.includes("integration") ? `
  # ── Stage 3: Testes de Integração ────────────────────────────────────────
  integration-tests:
    name: "Integration Tests"
    runs-on: ubuntu-latest
    needs: quality-gate
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Testes de integração
        run: ${integrationCmd}
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: testdb
          DB_USER: test
          DB_PASS: test
      - name: Upload relatório
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-report
          path: test-results/
` : ""}
${testTypes.includes("e2e") ? `
  # ── Stage 4: E2E Smoke (pós-deploy) ──────────────────────────────────────
  e2e-smoke:
    name: "E2E Smoke — Staging"
    runs-on: ubuntu-latest
    needs: [quality-gate]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Instalar Playwright
        run: npx playwright install --with-deps chromium
      - name: E2E smoke
        run: ${e2eCmd} --project=chromium --grep @smoke
        env:
          BASE_URL: \${{ secrets.STAGING_URL }}
      - name: Upload evidências
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
` : ""}
${testTypes.includes("performance") ? `
  # ── Stage 5: Performance (agendado) ──────────────────────────────────────
  performance:
    name: "Performance — k6"
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || contains(github.event.head_commit.message, '[perf]')
    steps:
      - uses: actions/checkout@v4
      - name: Setup k6
        uses: grafana/setup-k6-action@v1
      - name: Load test
        run: k6 run --env BASE_URL=\${{ secrets.STAGING_URL }} k6-plan.js
      - name: Upload resultados
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: k6-results
          path: resultado-k6.html
` : ""}

  # ── Resultado final do PR ──────────────────────────────────────────────────
  ci-result:
    name: "CI — Resultado Final"
    runs-on: ubuntu-latest
    needs: [quality-gate${testTypes.includes("contract") ? ", contract-tests" : ""}${testTypes.includes("integration") ? ", integration-tests" : ""}]
    if: always()
    steps:
      - name: Verificar resultado
        run: |
          if [[ "\${{ needs.quality-gate.result }}" != "success" ]]; then
            echo "❌ Quality gate falhou"
            exit 1
          fi
          echo "✅ Pipeline aprovado"
\`\`\`

---

## Estratégia de paralelismo e cache

\`\`\`yaml
# Cache de dependências (adicionar em cada job)
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: \${{ runner.os }}-npm-\${{ hashFiles('**/package-lock.json') }}
    restore-keys: \${{ runner.os }}-npm-

# Paralelismo de E2E com sharding
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=\${{ matrix.shard }}/4
\`\`\`

---

## Gates de qualidade (bloquear PR se falhar)

| Gate | Condição de bloqueio |
|------|---------------------|
| Lint | Qualquer erro |
| Typecheck | Qualquer erro |
| Unitários | Qualquer falha |
| Cobertura | < ${coverage}% |
| Contratos | Contrato publicado incompatível com provider |
| Integração | Qualquer falha |
| can-i-deploy | Provider não verificou contrato da versão atual |

---

Configure os secrets necessários: \`PACT_BROKER_URL\`, \`PACT_BROKER_TOKEN\`, \`STAGING_URL\`, \`API_TOKEN\`.`;
}

function qualityChecklist(args: Record<string, unknown>): string {
  const rawType = str(args.artifact_type);
  const artifactType = VALID_ARTIFACT_TYPES.has(rawType) ? rawType : "test-case";
  const content = optStr(args.artifact_content);

  const checklists: Record<string, { title: string; items: string[][] }> = {
    "user-story": {
      title: "User Story",
      items: [
        ["Critérios de aceitação claros e testáveis (não ambíguos)", "Crítico"],
        ["Pelo menos um critério por comportamento relevante", "Alto"],
        ["Critérios observáveis — resultado verificável (não 'deve funcionar')", "Crítico"],
        ["Ator, ação e benefício explícitos", "Alto"],
        ["Independente de outras histórias (INVEST — Independent)", "Médio"],
        ["Negociável — não especifica implementação técnica", "Médio"],
        ["Tamanho adequado — cabe em um sprint", "Médio"],
        ["Dependências externas identificadas", "Alto"],
        ["Requisitos não funcionais documentados (performance, segurança, acessibilidade)", "Alto"],
        ["Definição de Done aplicável", "Alto"],
        ["Impacto em funcionalidades existentes avaliado", "Médio"],
        ["Dados de teste e cenários edge case mencionados", "Médio"],
      ],
    },
    "test-plan": {
      title: "Plano de Testes",
      items: [
        ["Escopo definido — o que é e não é coberto", "Crítico"],
        ["Rastreabilidade — cada teste vinculado a um requisito/história", "Alto"],
        ["Pirâmide de testes com proporções definidas", "Alto"],
        ["Estratégia de dados de teste documentada", "Alto"],
        ["Ambientes necessários identificados", "Alto"],
        ["Critérios de entrada e saída definidos", "Alto"],
        ["Riscos e mitigações documentados", "Médio"],
        ["Ferramentas e frameworks especificados", "Médio"],
        ["Cronograma e responsáveis definidos", "Médio"],
        ["Critérios de aceitação de qualidade (cobertura, SLA, taxa de erro)", "Alto"],
        ["Estratégia de regressão definida", "Alto"],
        ["Testes não funcionais planejados (performance, segurança)", "Alto"],
      ],
    },
    "test-case": {
      title: "Caso de Teste",
      items: [
        ["ID único e requisito/critério vinculado", "Crítico"],
        ["Pré-condições completas e não ambíguas", "Alto"],
        ["Dados de entrada específicos (não 'dados válidos')", "Crítico"],
        ["Passos numerados e executáveis por qualquer membro do time", "Alto"],
        ["Resultado esperado verificável objetivamente", "Crítico"],
        ["Cleanup/teardown documentado", "Médio"],
        ["Prioridade e criticidade atribuídas", "Médio"],
        ["Cenários negativos e edge cases cobertos", "Alto"],
        ["Independente de outros casos de teste", "Alto"],
        ["Tempo estimado de execução razoável (< 30min manual)", "Baixo"],
        ["Screenshots ou evidências esperadas especificadas", "Baixo"],
      ],
    },
    "test-code": {
      title: "Código de Teste",
      items: [
        ["Nomes descrevem comportamento (should_X_when_Y)", "Alto"],
        ["Estrutura AAA clara (Arrange, Act, Assert)", "Alto"],
        ["Um comportamento por teste", "Alto"],
        ["Sem sleep() fixo ou timing frágil", "Crítico"],
        ["Sem compartilhamento de estado entre testes", "Crítico"],
        ["Cleanup em beforeEach/afterEach", "Alto"],
        ["Asserções específicas (não apenas toBeTruthy)", "Alto"],
        ["Mocks apenas para dependências externas", "Alto"],
        ["Dados de teste via builders/factories, não hardcoded", "Médio"],
        ["Testes unitários < 100ms em média", "Médio"],
        ["Sem lógica condicional no teste (if/else)", "Alto"],
        ["Todos os Promises aguardados (await)", "Crítico"],
        ["Cobertura de branches, não apenas linhas", "Médio"],
        ["Compatível com execução paralela", "Médio"],
      ],
    },
    "api-contract": {
      title: "Contrato de API",
      items: [
        ["Todos os endpoints do consumer documentados", "Crítico"],
        ["Provider states para cada interação definidos", "Crítico"],
        ["Matchers usados em vez de valores literais (id, timestamp, UUID)", "Alto"],
        ["Campos opcionais documentados separadamente", "Alto"],
        ["Cenários de erro (404, 401, 422) incluídos", "Alto"],
        ["Versionamento do contrato documentado", "Alto"],
        ["can-i-deploy integrado ao pipeline de deploy", "Crítico"],
        ["Provider valida contratos no CI", "Crítico"],
        ["Contrato publicado no Pact Broker ou equivalente", "Alto"],
        ["Backward compatibility verificada", "Alto"],
        ["Headers e status codes incluídos nas expectativas", "Médio"],
      ],
    },
    "test-suite": {
      title: "Suíte de Testes",
      items: [
        ["Cobertura ≥ 70% geral, ≥ 85% em código crítico", "Alto"],
        ["Suíte completa < 30min em CI paralelo", "Alto"],
        ["Taxa de flakiness < 2%", "Crítico"],
        ["Paralelismo configurado e funcionando", "Alto"],
        ["Relatórios gerados automaticamente (Allure, JUnit XML)", "Médio"],
        ["Falhas alertam o time imediatamente (Slack, email)", "Médio"],
        ["Testes isolados — podem rodar em qualquer ordem", "Crítico"],
        ["Pipeline de CI com gates de qualidade configurados", "Alto"],
        ["Estratégia de regressão para novas features definida", "Alto"],
        ["Documentação de como adicionar novos testes", "Médio"],
        ["Sem testes comentados ou skip sem justificativa e prazo", "Alto"],
        ["Política de flaky tests definida e seguida", "Alto"],
      ],
    },
    "bug-report": {
      title: "Bug Report",
      items: [
        ["Título descritivo: [Componente] Comportamento errado quando condição", "Alto"],
        ["Passos para reproduzir numerados e mínimos", "Crítico"],
        ["Comportamento esperado explicitado", "Crítico"],
        ["Comportamento atual explicitado", "Crítico"],
        ["Ambiente: OS, browser, versão, ambiente (prod/staging)", "Alto"],
        ["Evidências: screenshot, vídeo, log de erro, stack trace", "Alto"],
        ["Frequência: sempre, intermitente, uma vez", "Médio"],
        ["Impacto no usuário quantificado", "Médio"],
        ["Severidade e prioridade atribuídas com justificativa", "Médio"],
        ["Teste que demonstra o bug (TDD de correção)", "Alto"],
        ["Workaround documentado se existir", "Baixo"],
      ],
    },
    "acceptance-criteria": {
      title: "Critérios de Aceitação",
      items: [
        ["Formato Given-When-Then ou equivalente observável", "Alto"],
        ["Cada critério verifica exatamente um comportamento", "Alto"],
        ["Nenhum critério usa linguagem ambígua ('adequadamente', 'rapidamente', 'funcionar')", "Crítico"],
        ["Critérios cobrem happy path, negativo e edge cases relevantes", "Alto"],
        ["Critérios são independentes entre si", "Médio"],
        ["Critérios não especificam implementação técnica", "Alto"],
        ["Dados de entrada e saída específicos quando aplicável", "Alto"],
        ["Critérios de performance explicitados numericamente", "Médio"],
        ["Critérios de segurança incluídos para features sensíveis", "Alto"],
        ["Todos os stakeholders concordaram com os critérios", "Crítico"],
      ],
    },
  };

  const checklist = checklists[artifactType] ?? checklists["test-case"];

  const criticalItems = checklist.items.filter((i) => i[1] === "Crítico");
  const highItems = checklist.items.filter((i) => i[1] === "Alto");
  const mediumItems = checklist.items.filter((i) => i[1] === "Médio");
  const lowItems = checklist.items.filter((i) => i[1] === "Baixo");

  return `# Checklist de Qualidade — ${checklist.title}

${content ? `## Artefato analisado\n\`\`\`\n${content.slice(0, 500)}${content.length > 500 ? "\n... (truncado)" : ""}\n\`\`\`\n\n---\n` : ""}
## Itens obrigatórios

### 🔴 Crítico (bloqueante)
${criticalItems.map((i) => `- [ ] ${i[0]}`).join("\n")}

### 🟠 Alto (deve corrigir antes do merge)
${highItems.map((i) => `- [ ] ${i[0]}`).join("\n")}

### 🟡 Médio (deve corrigir no sprint)
${mediumItems.map((i) => `- [ ] ${i[0]}`).join("\n")}
${
  lowItems.length > 0
    ? `
### 🟢 Baixo (melhoria contínua)
${lowItems.map((i) => `- [ ] ${i[0]}`).join("\n")}`
    : ""
}

---

## Resultado esperado

| Resultado | Condição |
|-----------|----------|
| ✅ Aprovado | Todos os **Críticos** e **Altos** marcados |
| ⚠️ Aprovado condicional | Críticos OK, alguns Altos pendentes com issue criada |
| ❌ Reprovado | Qualquer item **Crítico** desmarcado |

---

${content ? `Revise o artefato fornecido e marque cada item. Aponte especificamente onde cada problema foi identificado.` : `Use esta lista para avaliar o artefato **${checklist.title}** antes de considerá-lo pronto.`}`;
}

function generateTestData(args: Record<string, unknown>): string {
  const fields = str(args.fields);
  const domain = optStr(args.domain) ?? "genérico";
  const format = optStr(args.format) ?? "JSON";
  const count = optStr(args.count) ?? "10";
  const constraints = optStr(args.constraints);

  return `# Geração de Dados de Teste

## Entrada recebida
- **Campos:** ${fields}
- **Domínio:** ${domain}
- **Formato de saída:** ${format}
- **Quantidade por categoria:** ${count}
${constraints ? `- **Restrições:** ${constraints}` : ""}

---

## 1. Categorias de dados a gerar

| Categoria | Objetivo | Exemplo de regra |
|-----------|----------|-------------------|
| Válido canônico | Representa o caso comum, bem formado | Todos os campos preenchidos dentro das regras |
| Válido variado | Cobre variações aceitas (formatos alternativos, opcionais ausentes) | Telefone com/sem DDI, nome com acento |
| Inválido por campo | Um campo inválido por vez, demais válidos | Email sem "@", CPF com dígito verificador errado |
| Ausente/nulo | Campo obrigatório nulo, vazio ou não enviado | \`null\`, \`""\`, campo omitido do payload |
| Boundary | Limite mínimo, máximo e ±1 de cada campo numérico/string | 0, 1, MAX-1, MAX, MAX+1 |
| Caracteres especiais | Unicode, emojis, HTML/SQL, espaços | \`<script>\`, \`' OR 1=1\`, \`café\`, \`🎯\`, \`   \` |
| Duplicado | Mesmo valor de campo único (email, CPF, SKU) em dois registros | Testa constraint de unicidade |
| Sensível/PII | Dados pessoais para testar mascaramento e LGPD/GDPR | CPF, email, cartão — sempre sintéticos, nunca reais |
| Volume | Dataset grande para performance/paginação | 10k+ registros com distribuição realista |

---

## 2. Estratégia de geração

1. **Nunca use dados reais de produção.** Gere sintéticos ou anonimize com hashing irreversível.
2. Use uma biblioteca de fake data determinística com seed fixo para reprodutibilidade (ex.: \`faker.seed(42)\`).
3. Para campos com regra de negócio (CPF, cartão, CEP), use gerador que respeita o algoritmo de validação (dígito verificador), não apenas o formato.
4. Para dados relacionais, gere na ordem de dependência (ex.: cliente antes de pedido) e reutilize IDs.
5. Versione datasets de teste junto ao código quando forem fixtures estáveis; gere dinamicamente quando o teste precisar de dados únicos por execução.

## 3. Exemplo de geração (ajuste os campos reais)

\`\`\`${format.toLowerCase() === "csv" ? "text" : "json"}
${
  format.toLowerCase() === "csv"
    ? `${fields || "campo1,campo2,campo3"}\nvalor_valido_1,valor_valido_2,valor_valido_3\n,valor_ausente,valor_valido`
    : `{\n  "valido_canonico": { ${fields ? `/* ${fields} preenchidos conforme regra */` : "/* campos preenchidos */"} },\n  "invalido_campo_x": { /* um campo inválido isolado */ },\n  "ausente": { /* campo obrigatório omitido */ },\n  "boundary_min": { /* valor mínimo aceito */ },\n  "boundary_max_mais_1": { /* valor acima do máximo, deve ser rejeitado */ }\n}`
}
\`\`\`

## 4. Ferramentas recomendadas por stack

| Stack | Biblioteca |
|-------|-----------|
| JavaScript/TypeScript | \`@faker-js/faker\`, \`test-data-bot\` |
| Python | \`Faker\`, \`factory_boy\`, \`hypothesis\` (property-based) |
| Java | \`Instancio\`, \`JavaFaker\`, \`EasyRandom\` |
| Banco de dados | \`pgbench\` (volume), scripts SQL com \`generate_series\` |

## 5. Checklist

- [ ] Nenhum dado real ou identificável usado
- [ ] Cada categoria (válido, inválido, boundary, ausente, especial) representada
- [ ] Dados sensíveis mascarados ou sintéticos com formato válido
- [ ] Seed fixo definido para reprodutibilidade
- [ ] Volume suficiente para teste de performance, se aplicável
- [ ] Dataset versionado ou gerado sob demanda conforme necessidade do teste`;
}

function designApiTests(args: Record<string, unknown>): string {
  const endpoint = str(args.endpoint);
  const method = optStr(args.method) ?? "GET";
  const authType = optStr(args.auth_type) ?? "não especificado";
  const requestSchema = optStr(args.request_schema);
  const apiStyle = optStr(args.api_style) ?? "REST";

  return `# Design de Testes de API

## Entrada recebida
- **Endpoint:** \`${method} ${endpoint}\`
- **Estilo:** ${apiStyle}
- **Autenticação:** ${authType}
${requestSchema ? `- **Schema de request:** fornecido (${requestSchema.length} chars)` : ""}

> Nota: este tool cobre testes **funcionais e de abuso** da API. Para compatibilidade entre consumer/provider, use \`design_contract_tests\`.

---

## 1. Casos funcionais

| Caso | Verificação |
|------|-------------|
| Happy path | Status 2xx, schema de resposta correto, campos obrigatórios presentes |
| Paginação | \`limit\`/\`offset\` ou cursor respeitados, total consistente, última página vazia |
| Filtros e ordenação | Combinações de query params, filtro inexistente retorna vazio (não erro) |
| Campos opcionais ausentes | Resposta usa default documentado, não quebra |
| Content negotiation | \`Accept\`/\`Content-Type\` corretos, 406/415 quando inválido |
| Idempotência (PUT/DELETE) | Repetir a mesma chamada produz o mesmo resultado final |
| Versionamento | Endpoint versionado responde conforme contrato daquela versão |

## 2. Casos negativos

| Caso | Resultado esperado |
|------|---------------------|
| Payload malformado (JSON inválido) | 400 com mensagem clara, sem stack trace |
| Campo obrigatório ausente | 400 com nome do campo específico |
| Tipo de dado incorreto | 400, não 500 |
| ID inexistente | 404, não 200 com corpo vazio |
| Método não permitido | 405 com \`Allow\` header |
| Timeout de dependência | 502/503/504 com mensagem, não 500 genérico |

## 3. Casos de segurança (OWASP API Security Top 10)

| Vetor | Teste |
|-------|-------|
| BOLA (Broken Object Level Authorization) | Usuário A tenta acessar/alterar recurso do usuário B pelo ID |
| Broken Authentication | Token expirado, ausente, malformado ou de outro usuário |
| Broken Object Property Level Authorization | Mass assignment — enviar campo que usuário não deveria alterar (ex.: \`role: admin\`) |
| Unrestricted Resource Consumption | Rate limiting ausente, paginação sem limite máximo, payload gigante |
| Broken Function Level Authorization | Usuário comum acessa endpoint administrativo |
| SSRF | URL fornecida pelo cliente é usada em chamada server-side sem validação |
| Injection | \`' OR 1=1--\`, operadores NoSQL (\`$gt\`, \`$where\`) em campos de filtro |
| Excessive Data Exposure | Resposta contém campos internos/sensíveis não usados pelo client |
| Security Misconfiguration | Headers ausentes (\`X-Content-Type-Options\`, CORS aberto demais), verbose errors |
| Improper Inventory Management | Versões antigas da API (\`/v1/\`) ainda acessíveis sem aviso |

## 4. Estrutura de teste sugerida

\`\`\`typescript
describe("${method} ${endpoint}", () => {
  it("retorna 2xx e schema válido no caso feliz", async () => {
    const res = await request(app).${method.toLowerCase()}("${endpoint}").set("Authorization", validToken);
    expect(res.status).toBe(200);
    expect(res.body).toMatchSchema(responseSchema);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).${method.toLowerCase()}("${endpoint}");
    expect(res.status).toBe(401);
  });

  it("retorna 403 ao acessar recurso de outro usuário (BOLA)", async () => {
    const res = await request(app).${method.toLowerCase()}(\`${endpoint}\`).set("Authorization", tokenUserA).send({ /* id do recurso de userB */ });
    expect(res.status).toBe(403);
  });

  it("rejeita payload com campo não permitido (mass assignment)", async () => {
    const res = await request(app).${method.toLowerCase()}("${endpoint}").set("Authorization", validToken).send({ role: "admin" });
    expect(res.status).toBe(400);
  });
});
\`\`\`

## 5. Checklist

- [ ] Todos os status codes documentados têm teste correspondente
- [ ] Autorização testada por objeto e por função (não só autenticação)
- [ ] Rate limiting e tamanho de payload validados
- [ ] Nenhum campo interno/sensível vaza na resposta
- [ ] Erros não expõem stack trace ou detalhes de implementação`;
}

function generateAutomationCode(args: Record<string, unknown>): string {
  const scenario = str(args.scenario);
  const framework = optStr(args.framework) ?? "Playwright";
  const language = optStr(args.language) ?? "TypeScript";
  const layer = optStr(args.layer) ?? "e2e";

  return `# Scaffold de Automação — ${framework} (${language})

## Entrada recebida
- **Cenário:** ${scenario}
- **Camada:** ${layer}
- **Framework:** ${framework}

---

## 1. Estrutura recomendada

\`\`\`text
tests/
  ${layer}/
    ${layer}.spec.ts        # casos de teste
    fixtures.ts             # setup/teardown e dados reutilizáveis
    page-objects/           # (apenas para UI) encapsula seletores e ações
\`\`\`

## 2. Scaffold gerado

\`\`\`typescript
import { test, expect } from "${framework.toLowerCase().includes("playwright") ? "@playwright/test" : "./fixtures"}";

test.describe("${scenario || "Cenário"}", () => {
  test.beforeEach(async ({ page }) => {
    // Arrange: estado inicial isolado — nunca depender de execução anterior
  });

  test("happy path", async ({ page }) => {
    // Given: precondição
    // When: ação principal do cenário
    // Then: resultado observável e verificável
    // Priorize seletores estáveis: getByRole, getByTestId, getByLabel — evite CSS/XPath frágil
    await expect(page.getByRole("button", { name: "Confirmar" })).toBeVisible();
  });

  test("caso negativo — entrada inválida", async ({ page }) => {
    // Verificar mensagem de erro e que a ação não teve efeito colateral
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: \`test-results/\${testInfo.title}-failure.png\` });
    }
  });
});
\`\`\`

## 3. Boas práticas aplicadas ao scaffold

- **Waits por condição**, nunca \`sleep\` fixo — use \`waitForSelector\`/\`toBeVisible\` com timeout explícito.
- **Isolamento**: cada teste cria e limpa seu próprio estado (não reutiliza dados de outro teste).
- **Seletores resilientes**: \`data-testid\`, role acessível ou label — evite depender de estrutura DOM ou classes de estilo.
- **Diagnóstico automático**: screenshot/trace/vídeo em falha, anexado ao relatório.
- **Retries limitados** apenas no nível de CI para falhas de infraestrutura, nunca para mascarar bugs.

## 4. Próximos passos

1. Substitua os comentários pelos passos reais do cenário: **${scenario}**.
2. Extraia seletores repetidos para um Page Object ou fixture somente se usados em 2+ testes.
3. Rode \`review_test_code\` neste arquivo antes de mergear para revisão de anti-patterns.
4. Adicione o novo teste ao pipeline via \`generate_ci_pipeline\`.`;
}

function optimizeTestSuite(args: Record<string, unknown>): string {
  const suiteDescription = str(args.suite_description);
  const metrics = optStr(args.metrics);
  const goal = optStr(args.goal) ?? "reduzir tempo de execução mantendo cobertura de risco";

  return `# Otimização de Suíte de Testes

## Entrada recebida
- **Suíte:** ${suiteDescription}
${metrics ? `- **Métricas fornecidas:** ${metrics}` : ""}
- **Objetivo:** ${goal}

---

## 1. Matriz de decisão por teste

Para cada teste da suíte, classifique e decida a ação:

| Teste | Risco coberto | Duração | Taxa de flaky | Redundância | Ação |
|-------|---------------|---------|----------------|-------------|------|
| (preencher) | Alto/Médio/Baixo | segundos | % falhas não relacionadas a bug | duplica outro teste? | Manter / Mesclar / Mover de camada / Remover / Quarentena |

Critérios de ação:
- **Manter:** cobre risco único, rápido, estável.
- **Mesclar:** dois testes verificam a mesma regra com dados diferentes — combine em teste parametrizado/Esquema do Cenário.
- **Mover de camada:** cenário testado em E2E que poderia ser validado em unitário ou integração com o mesmo nível de confiança.
- **Remover:** teste redundante, obsoleto, ou que testa comportamento já garantido por outro nível.
- **Quarentena:** flaky não resolvido — não deve bloquear o pipeline até correção.

## 2. Heurísticas de redundância

1. Dois testes que diferem apenas no dado de entrada, mas exercitam a mesma regra → parametrizar em um único teste.
2. Teste E2E que repete uma verificação já coberta por teste de integração ou unitário → manter só a camada mais barata que garante o mesmo risco.
3. Testes com o mesmo *arrange* e *assert*, variando apenas passos intermediários não relevantes → consolidar.
4. Cobertura de linha alta não implica ausência de redundância — meça por **risco coberto**, não por linha executada.

## 3. Priorização (quando o tempo de execução é restrito)

| Prioridade | Critério |
|------------|----------|
| P0 — sempre roda | Jornada crítica de negócio, dado protegido, ou requisito regulatório |
| P1 — roda em todo PR | Regras de negócio centrais, integrações principais |
| P2 — roda em pipeline agendado | Edge cases de baixo impacto, variações de UI |
| P3 — candidato a remoção | Sem falha registrada em 6+ meses e sem relação com risco ativo |

## 4. Plano de ação

1. Rode a suíte com coleta de métricas (duração e taxa de falha por teste) por pelo menos 20 execuções.
2. Aplique a matriz de decisão acima em cada teste.
3. Priorize a paralelização de testes independentes antes de remover cobertura.
4. Revalide a taxa de cobertura de risco (não de linha) após qualquer remoção.
5. Documente toda remoção com o motivo e o teste substituto (se houver).

## 5. Checklist

- [ ] Nenhuma remoção reduziu cobertura de um risco P0/P1 sem substituto
- [ ] Testes mesclados continuam cobrindo os mesmos boundary values
- [ ] Suíte otimizada foi executada 10x sem regressão de resultado
- [ ] Ganho de tempo medido e documentado (antes/depois)`;
}

function selfHealingTestStrategy(args: Record<string, unknown>): string {
  const framework = optStr(args.framework) ?? "Playwright";
  const failurePattern = optStr(args.failure_pattern);
  const currentStrategy = optStr(args.current_locator_strategy);

  return `# Estratégia de Automação Resiliente (Self-Healing)

## Entrada recebida
- **Framework:** ${framework}
${currentStrategy ? `- **Estratégia atual de localização:** ${currentStrategy}` : ""}
${failurePattern ? `- **Padrão de falha observado:** ${failurePattern}` : ""}

---

## 1. Hierarquia de seletores (do mais ao menos resiliente)

1. \`data-testid\` / \`data-qa\` dedicado — imune a mudanças visuais e de texto
2. Role acessível + nome (\`getByRole("button", { name: "Enviar" })\`) — resiliente e valida acessibilidade
3. Label/placeholder associado a input
4. Texto visível estável (evitar se traduzido/dinâmico)
5. Estrutura DOM/CSS/XPath posicional — **último recurso**, quebra com qualquer refactor visual

## 2. Fallback chain (auto-recuperação em runtime)

\`\`\`typescript
async function resilientLocate(page, primary: string, fallbacks: string[]) {
  const candidates = [primary, ...fallbacks];
  for (const selector of candidates) {
    const locator = page.locator(selector);
    if (await locator.count() > 0) return locator;
  }
  throw new Error(\`Nenhum seletor da cadeia resolveu: \${candidates.join(", ")}\`);
}

// uso: tenta data-testid, cai para role, depois texto
const submitBtn = await resilientLocate(page, "[data-testid=submit]", ["role=button[name='Enviar']", "text=Enviar"]);
\`\`\`

## 3. Detecção de drift (mudança de UI)

- Rode uma verificação periódica que reporta seletores que passaram a usar fallback (sinal de que o \`data-testid\` primário sumiu).
- Registre toda ativação de fallback em log/telemetria com o nome do teste e o seletor que falhou — isso vira um backlog de manutenção proativa em vez de falha silenciosa.
- Trate ativação de fallback como **warning no CI**, não falha — mas bloqueie o merge se o mesmo fallback for acionado repetidamente sem correção do \`data-testid\` original.

## 4. Retry e espera resiliente

\`\`\`typescript
// Espera por condição, nunca por tempo fixo
await expect(locator).toBeVisible({ timeout: 10_000 });

// Retry apenas para falhas de infraestrutura conhecidas, nunca para mascarar bug de lógica
test.describe.configure({ retries: process.env.CI ? 1 : 0 });
\`\`\`

## 5. Ferramentas de apoio a self-healing

| Categoria | Ferramentas |
|-----------|-------------|
| Auto-wait nativo | Playwright, Cypress (aguardam elemento estar acionável antes de interagir) |
| Comparação visual com tolerância | Applitools Eyes, Percy |
| Self-healing comercial (heurística de similaridade de DOM) | Testim, Mabl, Healenium |
| Diagnóstico em falha | Trace viewer (Playwright), vídeo/screenshot automático |

> Ferramentas comerciais de self-healing reduzem manutenção, mas não substituem \`data-testid\` bem definidos — trate-as como rede de segurança, não como estratégia primária.

## 6. Checklist

- [ ] Todo elemento interativo crítico tem \`data-testid\` estável
- [ ] Nenhum teste depende de XPath posicional ou classe CSS de estilo
- [ ] Fallback chain define e registra quando é acionada
- [ ] Waits são por condição observável, nunca \`sleep\` fixo
- [ ] Ativação recorrente de fallback vira item de manutenção, não é ignorada`;
}

function manualTestArtifactStandard(args: Record<string, unknown>): string {
  const storyId = str(args.story_id).toUpperCase() || "US-001";
  const storyTitle = str(args.story_title) || "Título da User Story";
  const slug = storyTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "user-story";
  const folderName = `${storyId}-${slug}`;
  const fileName = `${folderName}.md`;

  return `# Padrão de documentação por User Story

## Artefato definido
- **User Story:** ${storyId} — ${storyTitle}
- **Pasta:** \`qa-artifacts/manual-tests/${folderName}/\`
- **Arquivo único:** \`${fileName}\`
- **Título obrigatório:** \`# [${storyId}] ${storyTitle}\`

## Estrutura obrigatória

\`\`\`markdown
# [${storyId}] ${storyTitle}

## Objetivo do teste
Descrever o comportamento que a User Story deve comprovar.

- **História:** ${storyId}
- **Data:** YYYY-MM-DD
- **Ambiente:** staging
- **Status:** Aprovado | Reprovado | Bloqueado

## Pré-condições
...

## Caso de teste
### Cenário principal
...

### Passos e resultados
1. **Ação:** ...
   **Resultado esperado:** ...
   **Resultado obtido:** ...

## Bugs encontrados
### BUG-01 — Título do defeito
- **Severidade:** Alta | Média | Baixa
- **Status:** Aberto | Corrigido | Validado
- **Passos para reproduzir:** ...
- **Resultado esperado:** ...
- **Resultado obtido:** ...

## Ajustes encontrados
### AJU-01 — Título do ajuste
- **Prioridade:** Alta | Média | Baixa
- **Status:** Aberto | Aplicado | Validado
- **Descrição:** ...

## Evidências
- \`qa-artifacts/manual-tests/${folderName}/evidencias/screenshot-01.png\`
\`\`\`

## Regras

1. Crie a pasta da User Story antes do documento.
2. Crie apenas um arquivo Markdown por User Story.
3. Registre o caso de teste, todos os bugs e todos os ajustes no mesmo arquivo.
4. Use slug minúsculo, sem acentos e com hífens.
5. Mantenha evidências na subpasta \`evidencias/\` da própria User Story.
6. Procure as User Stories existentes antes de escolher o próximo ID.`;
}

// ─── List tools ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_user_story",
      description:
        "Analisa uma User Story e retorna framework completo de análise QA: decomposição, critérios de aceitação, cenários por camada (unit/contrato/integração/E2E), mapa de riscos por tipo de feature, perguntas de qualidade, dados de teste e checklist de completude.",
      inputSchema: {
        type: "object",
        properties: {
          story: { type: "string", description: "Texto completo da User Story." },
          context: { type: "string", description: "Contexto adicional: regras de negócio, restrições, integrações conhecidas." },
          tech_stack: { type: "string", description: "Stack tecnológica (ex.: 'Node.js, PostgreSQL, React')." },
          feature_type: {
            type: "string",
            enum: ["auth", "payment", "data", "ui", "api", "integration", "report", "notification", "search", "admin", "file-upload", "third-party-integration", "user-data", "other"],
            description: "Tipo de feature para adequar riscos de segurança e checklist.",
          },
        },
        required: ["story"],
      },
    },
    {
      name: "generate_test_strategy",
      description:
        "Gera estratégia completa de testes: pirâmide adaptada, ferramentas por camada, fluxo CI/CD, metas de cobertura, SLA de execução e roadmap faseado de implementação.",
      inputSchema: {
        type: "object",
        properties: {
          system_description: { type: "string", description: "Descrição do sistema ou módulo." },
          tech_stack: { type: "string", description: "Linguagens, frameworks, banco, mensageria, cloud." },
          architecture: {
            type: "string",
            enum: ["monolith", "microservices", "serverless", "modular-monolith", "event-driven", "other"],
            description: "Arquitetura do sistema.",
          },
          team_size: {
            type: "string",
            enum: ["solo", "small", "medium", "large"],
            description: "Tamanho do time (solo=1, small=2-5, medium=6-15, large=15+).",
          },
          constraints: { type: "string", description: "Restrições: legado, cobertura atual, ferramentas obrigatórias." },
        },
        required: ["system_description"],
      },
    },
    {
      name: "create_gherkin_scenarios",
      description:
        "Cria cenários BDD em Gherkin (Given-When-Then) a partir de critérios de aceitação. Inclui happy path, negativos, edge cases, Esquema do Cenário com tabelas e checklist de step definitions.",
      inputSchema: {
        type: "object",
        properties: {
          feature_name: { type: "string", description: "Nome da feature." },
          acceptance_criteria: { type: "string", description: "Critérios de aceitação." },
          user_role: { type: "string", description: "Papel do usuário (ex.: 'usuário autenticado', 'admin')." },
          context: { type: "string", description: "Contexto adicional: precondições, integrações." },
        },
        required: ["feature_name", "acceptance_criteria"],
      },
    },
    {
      name: "design_contract_tests",
      description:
        "Projeta testes de contrato Consumer-Driven (Pact) entre consumer e provider. Retorna estrutura de interações, provider states, matchers recomendados, versionamento e integração CI/CD com can-i-deploy.",
      inputSchema: {
        type: "object",
        properties: {
          consumer: { type: "string", description: "Nome do serviço consumidor." },
          provider: { type: "string", description: "Nome do serviço provedor." },
          interactions: { type: "string", description: "Descrição das interações: endpoints, métodos, payload esperado." },
          tech_stack: { type: "string", description: "Stack do consumer e provider." },
          pact_broker_url: { type: "string", description: "URL do Pact Broker." },
        },
        required: ["consumer", "provider", "interactions"],
      },
    },
    {
      name: "design_integration_tests",
      description:
        "Projeta testes de integração entre dois componentes. Retorna estrutura de teste com Testcontainers, setup/teardown, cenários happy path, erro e concorrência, estratégia de isolamento e observabilidade.",
      inputSchema: {
        type: "object",
        properties: {
          component_a: { type: "string", description: "Primeiro componente." },
          component_b: { type: "string", description: "Segundo componente (banco, API, fila, etc.)." },
          integration_type: {
            type: "string",
            enum: ["database", "rest-api", "message-queue", "cache", "file-system", "external-service", "service-to-service"],
            description: "Tipo de integração.",
          },
          tech_stack: { type: "string", description: "Linguagem, framework e tecnologias." },
          scenarios: { type: "string", description: "Cenários específicos a cobrir." },
        },
        required: ["component_a", "component_b"],
      },
    },
    {
      name: "generate_performance_plan",
      description:
        "Gera plano de performance com script k6 completo (smoke, load, stress, spike, soak), thresholds derivados do SLA, comandos de execução e guia de análise de resultados.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Endpoint ou fluxo a testar." },
          expected_load: { type: "string", description: "Carga esperada em produção." },
          sla: { type: "string", description: "SLA (ex.: 'p95 < 500ms, erro < 1%')." },
          test_types: {
            type: "array",
            items: { type: "string", enum: ["smoke", "load", "stress", "spike", "soak"] },
            description: "Tipos de teste. Padrão: todos.",
          },
          tech_stack: { type: "string", description: "Stack para ajuste de métricas." },
        },
        required: ["target"],
      },
    },
    {
      name: "security_test_checklist",
      description:
        "Retorna checklist de segurança OWASP Top 10 adaptado ao tipo de feature, com vetores de ataque, casos de teste, headers obrigatórios, ferramentas SAST/DAST e critérios de aceitação de segurança.",
      inputSchema: {
        type: "object",
        properties: {
          feature_type: {
            type: "string",
            enum: ["authentication", "authorization", "payment", "file-upload", "api-public", "api-internal", "admin-panel", "search", "user-data", "third-party-integration"],
            description: "Tipo de feature.",
          },
          context: { type: "string", description: "Contexto: autenticação usada, dados sensíveis, regulações (LGPD, PCI-DSS)." },
          tech_stack: { type: "string", description: "Stack para ferramentas específicas." },
        },
        required: ["feature_type"],
      },
    },
    {
      name: "review_test_code",
      description:
        "Revisa código de teste e retorna framework de análise com categorias: design, anti-patterns críticos, isolamento, qualidade de asserções, mocks, performance e cobertura de gaps.",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Código de teste para revisão." },
          language: { type: "string", description: "Linguagem (ex.: 'TypeScript', 'Python', 'Java')." },
          framework: { type: "string", description: "Framework (ex.: 'Jest', 'Pytest', 'JUnit 5', 'Playwright')." },
          context: { type: "string", description: "Contexto: o que o código testa, padrões esperados." },
        },
        required: ["code"],
      },
    },
    {
      name: "troubleshoot_flaky_test",
      description:
        "Diagnostica testes instáveis (flaky). Retorna hipóteses ordenadas por probabilidade, passos de diagnóstico, correções por causa raiz com exemplos de código e política de prevenção.",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "O que o teste verifica e como está implementado." },
          symptoms: { type: "string", description: "Frequência de falha, mensagem de erro, condições de falha (CI vs local, paralelo, horário)." },
          framework: { type: "string", description: "Framework e linguagem." },
          code: { type: "string", description: "Código do teste (altamente recomendado para diagnóstico preciso)." },
        },
        required: ["description", "symptoms"],
      },
    },
    {
      name: "generate_ci_pipeline",
      description:
        "Gera configuração CI/CD para GitHub Actions (e outros) com stages por camada de teste, paralelismo, cache, cobertura mínima, relatórios e gates de qualidade.",
      inputSchema: {
        type: "object",
        properties: {
          tech_stack: { type: "string", description: "Linguagem e frameworks do projeto." },
          test_types: {
            type: "array",
            items: { type: "string", enum: ["unit", "contract", "integration", "e2e", "performance", "security", "accessibility"] },
            description: "Tipos de teste a incluir.",
          },
          platform: {
            type: "string",
            enum: ["github-actions", "gitlab-ci", "azure-devops", "jenkins", "bitbucket-pipelines", "circleci"],
            description: "Plataforma CI/CD. Padrão: github-actions.",
          },
          coverage_target: { type: "number", description: "Cobertura mínima % (ex.: 80)." },
          context: { type: "string", description: "Contexto: monorepo, containers, ambientes necessários." },
        },
        required: ["tech_stack", "test_types"],
      },
    },
    {
      name: "quality_checklist",
      description:
        "Retorna checklist de qualidade para um artefato específico: user story, plano de testes, caso de teste, código de teste, contrato de API, suíte completa, bug report ou critérios de aceitação.",
      inputSchema: {
        type: "object",
        properties: {
          artifact_type: {
            type: "string",
            enum: ["user-story", "test-plan", "test-case", "test-code", "api-contract", "test-suite", "bug-report", "acceptance-criteria"],
            description: "Tipo do artefato.",
          },
          artifact_content: { type: "string", description: "Conteúdo do artefato para análise específica (opcional)." },
        },
        required: ["artifact_type"],
      },
    },
    {
      name: "generate_test_data",
      description:
        "Gera estratégia e exemplos de dados de teste sintéticos: válidos, inválidos, boundary, ausentes, caracteres especiais, duplicados e PII mascarada, com ferramentas recomendadas por stack.",
      inputSchema: {
        type: "object",
        properties: {
          fields: { type: "string", description: "Campos/entidade a gerar (ex.: 'nome, email, cpf, data_nascimento')." },
          domain: { type: "string", description: "Domínio de negócio (ex.: 'e-commerce', 'saúde', 'financeiro')." },
          format: { type: "string", enum: ["JSON", "CSV", "SQL"], description: "Formato de saída. Padrão: JSON." },
          count: { type: "string", description: "Quantidade de registros por categoria. Padrão: 10." },
          constraints: { type: "string", description: "Restrições de negócio ou regex/validações específicas." },
        },
        required: ["fields"],
      },
    },
    {
      name: "design_api_tests",
      description:
        "Projeta suíte de testes funcionais, negativos e de segurança (OWASP API Top 10) para um endpoint específico, incluindo BOLA, mass assignment, rate limiting e estrutura de código de exemplo.",
      inputSchema: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "Path do endpoint (ex.: '/api/v1/orders/:id')." },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "Método HTTP. Padrão: GET." },
          auth_type: { type: "string", description: "Tipo de autenticação (ex.: 'Bearer JWT', 'API Key', 'OAuth2')." },
          request_schema: { type: "string", description: "Schema/exemplo do payload de request, se houver." },
          api_style: { type: "string", enum: ["REST", "GraphQL", "gRPC"], description: "Estilo da API. Padrão: REST." },
        },
        required: ["endpoint"],
      },
    },
    {
      name: "generate_automation_code",
      description:
        "Gera scaffold de código de automação (estrutura, boas práticas, seletores resilientes, waits por condição) para um cenário de teste em um framework específico.",
      inputSchema: {
        type: "object",
        properties: {
          scenario: { type: "string", description: "Descrição do cenário a automatizar." },
          framework: { type: "string", description: "Framework (ex.: 'Playwright', 'Cypress', 'Pytest', 'REST Assured'). Padrão: Playwright." },
          language: { type: "string", description: "Linguagem. Padrão: TypeScript." },
          layer: { type: "string", enum: ["unit", "api", "integration", "e2e"], description: "Camada de teste. Padrão: e2e." },
        },
        required: ["scenario"],
      },
    },
    {
      name: "optimize_test_suite",
      description:
        "Analisa uma suíte de testes existente e retorna matriz de decisão (manter/mesclar/mover de camada/remover/quarentena), heurísticas de redundância e plano de priorização por risco.",
      inputSchema: {
        type: "object",
        properties: {
          suite_description: { type: "string", description: "Descrição da suíte: quantidade, tipos, nomes/tags dos testes." },
          metrics: { type: "string", description: "Métricas conhecidas: duração, taxa de flaky, cobertura." },
          goal: { type: "string", description: "Objetivo da otimização (ex.: 'reduzir tempo de CI de 40min para 15min')." },
        },
        required: ["suite_description"],
      },
    },
    {
      name: "self_healing_test_strategy",
      description:
        "Define estratégia de automação resiliente a mudanças de UI: hierarquia de seletores, fallback chain, detecção de drift e ferramentas de self-healing comerciais.",
      inputSchema: {
        type: "object",
        properties: {
          framework: { type: "string", description: "Framework de automação. Padrão: Playwright." },
          current_locator_strategy: { type: "string", description: "Estratégia de seletores usada atualmente." },
          failure_pattern: { type: "string", description: "Padrão de falha observado (ex.: 'quebra após todo deploy de UI')." },
        },
        required: [],
      },
    },
    {
      name: "manual_test_artifact_standard",
      description:
        "Define uma pasta e um único arquivo Markdown por User Story, com seções internas para caso de teste, bugs, ajustes e evidências.",
      inputSchema: {
        type: "object",
        properties: {
          story_id: { type: "string", description: "ID da User Story. Ex.: US-001." },
          story_title: { type: "string", description: "Título legível da User Story; será usado no título, pasta e nome do arquivo." },
        },
        required: ["story_title"],
      },
    },
  ],
}));

// ─── Call tool ────────────────────────────────────────────────────────────────

const TOOL_MAP = new Map<string, (a: Record<string, unknown>) => string>([
  ["analyze_user_story", analyzeUserStory],
  ["generate_test_strategy", generateTestStrategy],
  ["create_gherkin_scenarios", createGherkinScenarios],
  ["design_contract_tests", designContractTests],
  ["design_integration_tests", designIntegrationTests],
  ["generate_performance_plan", generatePerformancePlan],
  ["security_test_checklist", securityTestChecklist],
  ["review_test_code", reviewTestCode],
  ["troubleshoot_flaky_test", troubleshootFlakyTest],
  ["generate_ci_pipeline", generateCiPipeline],
  ["quality_checklist", qualityChecklist],
  ["generate_test_data", generateTestData],
  ["design_api_tests", designApiTests],
  ["generate_automation_code", generateAutomationCode],
  ["optimize_test_suite", optimizeTestSuite],
  ["self_healing_test_strategy", selfHealingTestStrategy],
  ["manual_test_artifact_standard", manualTestArtifactStandard],
]);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const handler = TOOL_MAP.get(name);
  if (!handler) throw new Error(`Ferramenta desconhecida: ${name}`);

  try {
    const text = handler(args as Record<string, unknown>);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Erro ao executar '${name}': ${message}`);
  }
});

// ─── Resources ────────────────────────────────────────────────────────────────

const RESOURCES = [
  {
    uri: "qa://pyramid",
    name: "Pirâmide de Testes",
    description: "Referência completa da pirâmide: distribuição, velocidade, custo e objetivo por camada.",
    mimeType: "text/markdown",
  },
  {
    uri: "qa://tool-matrix",
    name: "Matriz de Ferramentas",
    description: "Guia de seleção de ferramenta por necessidade, stack e contexto.",
    mimeType: "text/markdown",
  },
  {
    uri: "qa://gherkin-template",
    name: "Template Gherkin",
    description: "Template de Feature File BDD com exemplos de todos os tipos de cenário.",
    mimeType: "text/markdown",
  },
  {
    uri: "qa://k6-templates",
    name: "Templates k6",
    description: "Scripts k6 prontos para smoke, load, stress, spike e soak.",
    mimeType: "text/markdown",
  },
  {
    uri: "qa://glossary",
    name: "Glossário QA/SDET",
    description: "Definições de termos técnicos de qualidade de software.",
    mimeType: "text/markdown",
  },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const contents: Record<string, string> = {
    "qa://pyramid": `# Pirâmide de Testes

## Distribuição recomendada

| Camada | % Ideal | Execução | Custo | Objetivo |
|--------|---------|----------|-------|----------|
| **Unitário** | 70-80% | < 1 min | Muito baixo | Regras e decisões locais |
| **Contrato** | 5-10% | 1-3 min | Baixo | Compatibilidade consumer/provider |
| **Integração** | 15-25% | 5-15 min | Médio | Banco, APIs, filas, módulos reais |
| **E2E / UI** | 5-10% | 10-30 min | Alto | Jornadas críticas do usuário |
| **Performance** | 2-5% | Variável | Médio-alto | Latência, capacidade, degradação |
| **Segurança** | 1-3% | Variável | Médio-alto | Exposição, abuso, controles |

## Quando ajustar

- **Mais unitários:** bibliotecas de regras de negócio, engines de cálculo
- **Mais contratos:** microsserviços com múltiplos consumers
- **Mais integração:** sistemas com banco complexo, queries críticas
- **Menos E2E:** quando integração cobre o mesmo risco com mais velocidade
- **Mais performance:** sistemas de alta disponibilidade, pagamentos, busca

## Anti-pattern: pirâmide invertida (sorvete)

Muitos E2E + poucos unitários = lento, caro e frágil. Sintomas:
- Suíte demora > 1h
- Falhas intermitentes frequentes
- Dificuldade de identificar causa raiz
- Custo alto de manutenção

## Regra prática

> "Se um teste de integração cobre o mesmo risco que um E2E, prefira o de integração. Se um unitário cobre o mesmo risco que um de integração, prefira o unitário."
`,
    "qa://tool-matrix": `# Matriz de Seleção de Ferramentas

## Por linguagem e camada

| Camada | JavaScript/TypeScript | Python | Java | C# | Go |
|--------|----------------------|--------|------|----|----|
| Unitário | Jest, Vitest | Pytest | JUnit 5 | NUnit, xUnit | testing |
| Mock | Jest mock, Sinon | unittest.mock | Mockito | Moq | gomock |
| Contrato | Pact, Jest Pact | Pact Python | Pact JVM, Spring Cloud Contract | PactNet | Pact Go |
| API | Supertest, Axios | Requests, HTTPX | REST Assured | RestSharp | net/http |
| Mock API | Nock, MSW | responses, VCR | WireMock | WireMock.Net | httptest |
| Integração | Jest + Testcontainers | Pytest + Testcontainers | @DataJpaTest, Testcontainers | Testcontainers.net | Testcontainers-go |
| Web E2E | Playwright, Cypress | Playwright, Selenium | Selenium, Playwright | Playwright, Selenium | playwright-go |
| Mobile | Appium, Detox | Appium | Espresso, Appium | Appium | - |
| Performance | k6, Artillery | Locust, k6 | JMeter, Gatling | NBomber | k6 |
| BDD | Cucumber.js, Jest Cucumber | Behave | Cucumber, JUnit 5 | SpecFlow | Godog |

## Por necessidade

### Preciso testar API REST
- **Exploração rápida:** Postman, Thunder Client, Bruno
- **Testes automatizados JS:** Supertest (integrado ao Express)
- **Testes automatizados Java:** REST Assured
- **Mock de API:** WireMock (server), Nock (JS intercept), MSW (browser + Node)

### Preciso testar UI web
- **Recomendado:** Playwright (multi-browser, paralelo, trace)
- **Ecossistema JS:** Cypress (DX excelente, limitado a Chromium-based)
- **Legado/multi-browser real:** Selenium WebDriver
- **Visual regression:** Playwright + Percy, Chromatic, Applitools

### Preciso testar contratos
- **Multi-stack:** Pact + Pact Broker (padrão da indústria)
- **Apenas Java/Spring:** Spring Cloud Contract
- **Apenas JS:** Jest Pact

### Preciso banco de dados real nos testes
- **Qualquer stack:** Testcontainers (Docker, mesmo banco de produção)
- **Java/Spring JPA:** @DataJpaTest + H2 (somente se queries simples)
- **Python:** pytest-postgresql, testcontainers-python

### Preciso observar qualidade contínua
- **Cobertura:** Istanbul/nyc (JS), Coverage.py, JaCoCo
- **Qualidade de código:** SonarQube, CodeClimate
- **Relatórios:** Allure, ReportPortal, Playwright HTML report
- **Mutation testing:** Stryker (JS/TS), PIT (Java), mutmut (Python)
`,
    "qa://gherkin-template": `# Template Gherkin

## Feature file completo

\`\`\`gherkin
# language: pt

Funcionalidade: [Nome da funcionalidade]
  Como [tipo de usuário/ator]
  Quero [ação ou objetivo]
  Para [benefício ou valor de negócio]

  Contexto:
    Dado que o sistema está operacional
    E o banco de dados está em estado inicial limpo

  # ── Happy path ──────────────────────────────────────────────────────────────

  Cenário: [Nome descritivo no formato "deve X quando Y"]
    Dado [estado inicial]
    E [estado adicional, se necessário]
    Quando [ação realizada]
    Então [resultado observável esperado]
    E [resultado adicional]

  # ── Cenário parametrizado ─────────────────────────────────────────────────

  Esquema do cenário: [Nome parametrizado]
    Dado [estado com "<variável>"]
    Quando [ação com "<variável>"]
    Então [resultado com "<esperado>"]

    Exemplos:
      | variável | esperado |
      | valor1   | resultado1 |
      | valor2   | resultado2 |

  # ── Cenários negativos ───────────────────────────────────────────────────

  Cenário: Deve rejeitar quando [condição de erro]
    Dado [estado que provoca erro]
    Quando [ação]
    Então [mensagem de erro esperada]
    E o status deve ser [4xx/5xx]

  # ── Tags de organização ──────────────────────────────────────────────────

  @smoke @critico
  Cenário: [Cenário de smoke test]
    ...

  @flaky @pendente
  Cenário: [Cenário instável em triagem]
    ...

  @acessibilidade
  Cenário: [Cenário de acessibilidade]
    ...
\`\`\`

## Boas práticas

- Passos em linguagem de negócio — sem código, SQL ou detalhes técnicos
- Given: estado, não ação
- When: uma única ação
- Then: resultado observável pelo usuário ou sistema
- Máximo 5-7 passos por cenário
- Nomes de cenário no formato "deve [resultado] quando [condição]"
- Usar Background para pré-condições repetidas em todos os cenários
`,
    "qa://k6-templates": `# Templates k6

## Smoke test
\`\`\`javascript
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: { http_req_failed: ["rate==0"], http_req_duration: ["p(95)<1000"] },
};

export default function () {
  const res = http.get(__ENV.BASE_URL + "/health");
  check(res, { "status 200": (r) => r.status === 200 });
}
\`\`\`

## Load test
\`\`\`javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "5m", target: 50 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(__ENV.BASE_URL + "/api/resource");
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
\`\`\`

## Stress test
\`\`\`javascript
export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "2m", target: 400 },
    { duration: "2m", target: 0 },
  ],
};
\`\`\`

## Spike test
\`\`\`javascript
export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "1m", target: 10 },
    { duration: "10s", target: 500 },  // spike
    { duration: "3m", target: 500 },
    { duration: "10s", target: 10 },   // recovery
    { duration: "3m", target: 10 },
    { duration: "10s", target: 0 },
  ],
};
\`\`\`

## Soak test
\`\`\`javascript
export const options = {
  stages: [
    { duration: "5m", target: 30 },
    { duration: "1h", target: 30 },   // sustentação longa
    { duration: "5m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};
\`\`\`
`,
    "qa://glossary": `# Glossário QA / SDET

| Termo | Definição |
|-------|-----------|
| **AAA** | Arrange-Act-Assert — estrutura recomendada para testes unitários |
| **BDD** | Behavior-Driven Development — desenvolvimento orientado a comportamento com Gherkin |
| **BOLA/IDOR** | Broken Object Level Authorization — acesso a recurso de outro usuário via ID |
| **CDC** | Consumer-Driven Contracts — contratos definidos pelo consumer |
| **Circuit Breaker** | Padrão que interrompe chamadas a serviço falho para proteger o sistema |
| **Code Coverage** | Percentual de código executado pelos testes (linhas, branches, funções) |
| **DAST** | Dynamic Application Security Testing — testes de segurança em aplicação em execução |
| **Escaped Defect** | Bug encontrado em produção que deveria ter sido detectado pelos testes |
| **Fixture** | Dado ou estado pré-configurado para uso em testes |
| **Flaky Test** | Teste que falha intermitentemente sem mudança no código |
| **Given-When-Then** | Formato de escrita de cenários BDD |
| **Idempotência** | Propriedade de uma operação que produz o mesmo resultado independente do número de execuções |
| **Mock** | Objeto simulado que verifica interações e retorna valores pré-definidos |
| **Mutation Testing** | Técnica que introduz bugs intencionais no código para validar a eficácia dos testes |
| **Pact** | Framework open-source para Consumer-Driven Contract Testing |
| **Page Object Model** | Padrão de design que encapsula elementos e ações de uma página em uma classe |
| **Provider State** | Pré-condição que o provider deve satisfazer para uma interação de contrato |
| **Race Condition** | Bug causado por execução concorrente não sincronizada |
| **Regression Test** | Teste que verifica que uma funcionalidade existente não foi quebrada |
| **SAST** | Static Application Security Testing — análise estática de código por vulnerabilidades |
| **SLA** | Service Level Agreement — acordos de nível de serviço (latência, disponibilidade) |
| **Smoke Test** | Testes rápidos que verificam funcionalidade básica após deploy |
| **Spy** | Objeto que registra interações sem alterar comportamento real |
| **Step Definition** | Implementação de código de um passo Gherkin |
| **Stub** | Objeto que retorna valores pré-definidos sem verificar interações |
| **TDD** | Test-Driven Development — escrever teste antes da implementação |
| **Test Pyramid** | Modelo que recomenda proporção maior de testes unitários em relação a E2E |
| **Testcontainers** | Biblioteca que inicia containers Docker durante a execução de testes |
| **Think Time** | Pausa simulada entre requisições em testes de performance para imitar usuário real |
| **WireMock** | Servidor de mock para APIs HTTP em testes de integração |
`,
  };

  if (!Object.hasOwn(contents, uri)) throw new Error(`Recurso não encontrado: ${uri}`);
  const text = contents[uri];

  return { contents: [{ uri, mimeType: "text/markdown", text }] };
});

// ─── Prompts ──────────────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "analyze-story",
      description: "Inicia sessão de análise completa de User Story como QA Engineer SDET Senior.",
      arguments: [
        { name: "story", description: "Texto da User Story", required: true },
        { name: "context", description: "Contexto adicional (stack, regras, integrações)", required: false },
      ],
    },
    {
      name: "start-tdd",
      description: "Inicia sessão TDD guiada (Red → Green → Refactor) para uma funcionalidade.",
      arguments: [
        { name: "feature", description: "Funcionalidade a implementar com TDD", required: true },
        { name: "tech_stack", description: "Linguagem e framework", required: false },
      ],
    },
    {
      name: "write-test-plan",
      description: "Inicia elaboração de plano de testes para um sistema ou módulo.",
      arguments: [
        { name: "system", description: "Sistema ou módulo a testar", required: true },
        { name: "constraints", description: "Restrições conhecidas", required: false },
      ],
    },
    {
      name: "debug-failure",
      description: "Inicia sessão de diagnóstico de falha em teste ou ambiente de QA.",
      arguments: [
        { name: "failure_description", description: "Descrição da falha observada", required: true },
        { name: "context", description: "Logs, stack trace, ambiente", required: false },
      ],
    },
    {
      name: "autonomous-qa-agent",
      description: "Orquestra as ferramentas do MCP em sequência para levar uma feature do zero até pipeline pronto: história → estratégia → dados → API → automação → CI.",
      arguments: [
        { name: "feature", description: "Feature ou sistema a ser coberto por QA de ponta a ponta", required: true },
        { name: "tech_stack", description: "Stack tecnológica", required: false },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const prompts: Record<string, { description: string; text: string }> = {
    "analyze-story": {
      description: "Análise completa de User Story — QA Engineer SDET Senior",
      text: `Atue como QA Engineer SDET Senior e analise a seguinte User Story com profundidade e precisão técnica.

User Story:
${str(args.story) || "(não fornecida)"}

${str(args.context) ? `Contexto adicional:\n${str(args.context)}\n` : ""}
Use a ferramenta \`analyze_user_story\` para estruturar a análise e então produza:
1. Critérios de aceitação testáveis
2. Casos de teste por camada (unit, contrato, integração, E2E)
3. Mapa de riscos
4. Dados de teste necessários
5. Checklist de completude

Seja específico, prático e cubra cenários positivos, negativos e edge cases.`,
    },
    "start-tdd": {
      description: "Sessão TDD guiada — Red → Green → Refactor",
      text: `Atue como QA Engineer SDET Senior e conduza uma sessão de TDD para a seguinte funcionalidade.

Funcionalidade:
${str(args.feature) || "(não fornecida)"}

${str(args.tech_stack) ? `Stack: ${str(args.tech_stack)}\n` : ""}
Siga o ciclo:
1. 🔴 **Red:** escreva o menor teste possível que falha pelo motivo certo
2. 🟢 **Green:** implemente apenas o necessário para o teste passar
3. 🔵 **Refactor:** melhore o design sem alterar comportamento

Comece pelo teste mais simples (happy path unitário) e evolua gradualmente para cenários de erro e edge cases. Use \`create_gherkin_scenarios\` para critérios de aceitação se aplicável.`,
    },
    "write-test-plan": {
      description: "Elaboração de plano de testes",
      text: `Atue como QA Engineer SDET Senior e elabore um plano de testes completo para o sistema abaixo.

Sistema:
${str(args.system) || "(não fornecido)"}

${str(args.constraints) ? `Restrições:\n${str(args.constraints)}\n` : ""}
Use a ferramenta \`generate_test_strategy\` e produza um plano com:
1. Escopo e exclusões
2. Pirâmide de testes adaptada ao sistema
3. Ferramentas recomendadas com justificativa
4. Fluxo CI/CD
5. Metas de cobertura e SLA de execução
6. Roadmap faseado de implementação
7. Riscos do plano e mitigações`,
    },
    "debug-failure": {
      description: "Diagnóstico de falha em teste ou ambiente QA",
      text: `Atue como QA Engineer SDET Senior e diagnostique a seguinte falha com rigor técnico.

Falha observada:
${str(args.failure_description) || "(não fornecida)"}

${str(args.context) ? `Contexto (logs, stack trace, ambiente):\n${str(args.context)}\n` : ""}
Siga o processo:
1. **Sintomas:** o que foi observado
2. **Hipóteses:** causas prováveis ordenadas por probabilidade
3. **Evidências:** o que confirma ou descarta cada hipótese
4. **Causa raiz:** diagnóstico final
5. **Correção:** solução concreta com código quando aplicável
6. **Prevenção:** como evitar que se repita

Use \`troubleshoot_flaky_test\` se a falha for intermitente.`,
    },
    "autonomous-qa-agent": {
      description: "Agente QA autônomo — orquestra o ciclo completo de qualidade para uma feature",
      text: `Atue como QA Engineer SDET Senior atuando como agente autônomo de qualidade. Conduza a feature abaixo por todo o ciclo de QA, encadeando as ferramentas do MCP e usando a saída de cada etapa como entrada da próxima.

Feature:
${str(args.feature) || "(não fornecida)"}

${str(args.tech_stack) ? `Stack: ${str(args.tech_stack)}\n` : ""}
Execute nesta ordem, adaptando ou pulando etapas que não se apliquem:

1. \`analyze_user_story\` — decomponha a feature, extraia critérios de aceitação e mapa de riscos
2. \`generate_test_strategy\` — defina a pirâmide de testes e ferramentas adequadas ao risco identificado
3. \`create_gherkin_scenarios\` — converta os critérios em cenários BDD (happy path, negativos, edge cases)
4. \`generate_test_data\` — gere os dados necessários para os cenários (válidos, inválidos, boundary, PII mascarada)
5. \`design_api_tests\` e/ou \`design_contract_tests\` — se a feature expõe/consome API
6. \`security_test_checklist\` — aplique o checklist OWASP adequado ao tipo de feature
7. \`generate_automation_code\` — gere o scaffold de automação para os cenários priorizados
8. \`self_healing_test_strategy\` — se a feature envolve UI, defina seletores resilientes
9. \`generate_ci_pipeline\` — integre os testes gerados ao pipeline com gates de qualidade
10. \`quality_checklist\` (artifact_type: test-suite) — valide a completude final antes de considerar pronto

Ao final, apresente um resumo único com: riscos cobertos, lacunas conhecidas, artefatos gerados e próximos passos recomendados. Não invente dados, endpoints ou comportamento não informado — marque como hipótese e pergunte antes de assumir.`,
    },
  };

  if (!Object.hasOwn(prompts, name)) throw new Error(`Prompt não encontrado: ${name}`);
  const prompt = prompts[name as keyof typeof prompts];

  return {
    description: prompt.description,
    messages: [{ role: "user", content: { type: "text", text: prompt.text } }],
  };
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("MCP QA SDET Server v2.1.0 pronto.\n");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
