# Manual testing — Adicionar campo de ciclo de visita no drawer de criação de cliente

**Módulo:** Empresas / Clientes (drawer de criação)  
**História:** Web Angular e API — Adicionar campo de ciclo de visita no drawer de criação de cliente  
**Ambiente:** Desenvolvimento  
**Login:** https://app-develop.checkmob.com/Account/Login  
**Tela:** https://web-development.checkmob.com/cliente/lista  
**Usuário de teste:** `michaelmaia` (senha combinada neste chat; **não versionar**)  
**Data da execução:** 23/09/2026  
**Perfil observado:** conta de desenvolvimento (acesso a **Adicionar empresa**)

**API observada**

- `POST https://api-development.checkmob.com/api/v1/Cliente/Post`  
  Campo persistido: `cicloVisita` (número de dias ou `null`).
- `POST https://api-development.checkmob.com/api/v4/cliente/list`  
  Retorna `cicloVisita` e `statusCicloVisita` no item criado.

**Pré-condição comum**

1. Autenticar no develop e abrir a lista de empresas.
2. Clicar em **Adicionar empresa** (`drawerNovoCliente`).

---

## O que passou

- Há configuração de ciclo no drawer de criação (não é preciso editar depois para gravar o valor).
- Dropdown com **7, 14, 21, 30, 45, 60, 90 dias** + **Personalizado** + **Nenhum**.
- Ao escolher **30 dias**, o combobox mostra **“30 dias”**.
- **Personalizado** abre o modal `app-modal-ciclo-visita-personalizado` (**Personalizar intervalo** / `type="number"` `min="1"`). **37** → campo fica **“37 dias”**. **120** pelo modal também funciona.
- Campo **não obrigatório** (`aria-required="false"`). Default **Nenhum**.
- Persistência:
  - Cliente `QA Ciclo 37d …` (id `38207593`): body `"cicloVisita":37` → `200` `{"success":true,"data":38207593}`. Lista: `cicloVisita: 37`.
  - Cliente `QA Ciclo Nenhum …` (id `38207594`): `"cicloVisita":null` → criado sem ciclo.

---

## BUG-35 — Ciclo não está na seção Carteira nem com o rótulo “Ciclo de visita”

**Título do bug**  
O ciclo vive numa seção própria, com label **Intervalo**, depois de **Temperatura**.

**Descrição do problema**  
Aceite: campo **“Ciclo de visita”** na seção **Carteira**, **após** Segmento, Setor de mercado, Categoria e Etapa do funil.

No drawer a ordem real é:

1. **CARTEIRA** — Segmento, Setor, Categoria, Etapa do funil, **Temperatura** (campo extra, sem ciclo).
2. **CICLO DE VISITA** (seção nova) — único campo **Intervalo**, valor inicial **Nenhum**.

O usuário não encontra “Ciclo de visita” como campo da carteira; o título de seção e o `mat-label` divergem do aceite.

**Repro steps**

1. Cumprir a pré-condição.
2. Ler as seções do `drawerNovoCliente`.
3. Comparar labels de Carteira vs. ciclo.

**Actual results**

- Seções: IDENTIFICAÇÃO, CARTEIRA, **CICLO DE VISITA**, CONTATO, INFORMAÇÕES ADICIONAIS.
- Label do controle: **Intervalo**.

**Expected results**

- Um campo **Ciclo de visita** dentro de **Carteira**, imediatamente após Etapa do funil.

---

## BUG-36 — Falta a opção pré-definida “120 dias”

**Título do bug**  
O dropdown não lista **120 dias**.

**Descrição do problema**  
Aceite: 7, 14, 21, 30, 45, 60, 90, **120** dias e Personalizado.

`mat-option` observadas: **Nenhum**, 7, 14, 21, 30, 45, 60, 90, Personalizado. Sem **120 dias**.

Dá para chegar a 120 só pelo modal Personalizado (não é o preset pedido). **Nenhum** extra cobre o opcional, mas não substitui o 120.

**Repro steps**

1. Abrir o drawer → clicar em **Intervalo**.
2. Conferir a lista de opções.

**Actual results**

- Sem **120 dias**. Há **Nenhum**.

**Expected results**

- Preset **120 dias** no dropdown.

---

## BUG-37 — “Personalizado” abre um modal em vez de trocar o select por input no drawer

**Título do bug**  
O aceite pede substituição do campo de seleção por texto livre; a UI abre **Personalizar intervalo**.

**Descrição do problema**  
Aceite: ao selecionar **Personalizado**, o select **é substituído** por input de texto livre no próprio campo.

Comportamento: o `mat-select` permanece. Valor flash **“personalizado dias”** (p minúsculo). Abre `modalCicloVisitaPersonalizado` com **QTDE DE DIAS DO CICLO**, input `number` (`min="1"`, default **1**, `required`). **Concluir** com 37/120 devolve **“37 dias”** / **“120 dias”** no select.

O fluxo customizado **funciona**, mas não é o padrão do aceite (inline). **0** não conclui (`validity: false`); **−5** ainda entra no input (HTML `number` não impede digitação).

**Repro steps**

1. Abrir o drawer → **Intervalo** → **Personalizado**.
2. Ver se o select some e vira input no drawer.
3. Digitar 37 → **Concluir**.
4. Tentar 0 → **Concluir**.

**Actual results**

- Modal por cima do drawer; select continua lá.
- 37/120 ok; 0 não fecha o modal.

**Expected results**

- Select some; input de dias no lugar do campo, no drawer.

---

## BUG-38 — Input “Personalizar intervalo” aceita 121 (e mais) dígitos

**Título do bug**  
Não há limite de caracteres/dígitos no campo **QTDE DE DIAS DO CICLO**.

**Descrição do problema**  
O input é `type="number"` com `min="1"`, **sem** `max`, **sem** `maxLength` (`maxLength: -1`). Cabem 121 dígitos (`1` repetido 121 vezes). **Concluir** fecha o modal e o drawer mostra o valor em notação científica: **`1.111111111111111e+120 dias`**. Não há teto de negócio (ex. 3–4 dígitos / 365 / 999).

**Repro steps**

1. **Adicionar empresa** → **Intervalo** → **Personalizado**.
2. No modal **Personalizar intervalo**, no campo numérico, colar/digitar 121 caracteres numéricos (ex. 121 vezes `1`).
3. Conferir que o valor inteiro permanece no input.
4. Clicar **Concluir**.

**Actual results**

- Os 121 dígitos são aceitos (`len === 121`).
- Após concluir: **Intervalo = `1.111111111111111e+120 dias`**.

**Expected results**

- Limite de dígitos (e/ou `max` razoável). Recusar ou truncar com mensagem, sem notação científica no combo.

---

## BUG-39 — Campo numérico aceita caracteres especiais (`+`, `.`, `e`, `-`)

**Título do bug**  
É possível inserir `+`, `.`, notação científica e sinal negativo no input de dias.

**Descrição do problema**  
`type="number"` sem `step="1"` nem máscara de inteiro positivo. O browser deixa:

| Digitado | Valor no input | Observação |
|---|---|---|
| `+5` | `5` | `+` entra na digitação; o value acaba numérico |
| `.5` / `1.5` | `.5` / `1.5` | ponto decimal permanece |
| `1e2` / `12e3` | `1e2` / `12e3` | `e` (exponencial) válido |
| `-1` | `-1` | negativo (abaixo de `min="1"`, `valid: false`) |

**Concluir** com `12.5` (`validity.valid: false`) **mesmo assim** fechou o modal e gravou **`12 dias`** no select (trunca sem erro visível).

**Repro steps**

1. Abrir **Personalizar intervalo**.
2. Digitar `.` e `1.5` — o ponto permanece.
3. Digitar `+5`, `1e2`, `-1`.
4. Preencher `12.5` e clicar **Concluir**.

**Actual results**

- `.`, `e` e `-` ficam no campo; `+` é aceito na digitação.
- `12.5` + **Concluir** → **12 dias**, sem mensagem.

**Expected results**

- Somente inteiro ≥ 1 (dígitos). Bloquear `+ . e -` e não concluir valor inválido/decimal.

---

## BUG-40 — Com ciclo personalizado já definido, escolher de novo “Personalizado” não reabre o modal

**Título do bug**  
Não dá para corrigir o intervalo personalizado sem passar por um preset.

**Descrição do problema**  
Depois de **Concluir** um valor custom (ex. 37 dias ou o valor enorme do BUG-38), o `mat-select` fica com a opção **Personalizado** já selecionada (`aria-selected=true`). Abrir **Intervalo** e clicar **Personalizado** de novo **não dispara** o modal (`mat-dialog-container` ausente). O valor antigo permanece. Workaround: escolher um período pré-definido (ex. **7 dias**) e só então **Personalizado** — aí o modal abre.

Quem errou o número não consegue editar direto.

**Repro steps**

1. **Intervalo** → **Personalizado** → informar um valor (ex. 37) → **Concluir**.
2. Clicar de novo em **Intervalo**.
3. Clicar **Personalizado** (já marcado).
4. Observar que o modal **não** abre.
5. Selecionar **7 dias**, abrir de novo e escolher **Personalizado** — o modal abre.

**Actual results**

- Passo 3: dropdown fecha; campo continua com o valor anterior; sem modal.
- Passo 5: modal volta.

**Expected results**

- Cada clique em **Personalizado** abre **Personalizar intervalo**, pré-preenchido com o valor atual, para correção.

---

## Observações (não abertos como bug desta US)

- Coluna da lista com chave i18n **`cicloDeVisita`** (não traduzida). Fora do aceite do drawer, mas o dado 37 aparece no JSON da lista.
- Título do drawer **“Novo empresa”**.
- Perfil **gestor** vs administrador não isolado.
- Clientes de teste criados: `38207593` (37 dias) e `38207594` (`cicloVisita: null`).
