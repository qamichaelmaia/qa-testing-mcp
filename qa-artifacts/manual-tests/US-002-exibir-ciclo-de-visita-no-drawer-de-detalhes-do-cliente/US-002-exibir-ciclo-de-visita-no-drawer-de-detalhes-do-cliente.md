# [US-002] Exibir ciclo de visita no drawer de detalhes do cliente

## Objetivo do teste
Confirmar que o gestor consegue ver, na lista de empresas, o ciclo de visita do cliente no drawer de detalhes — última visita, status e intervalo — sem abrir a tela completa.

- **História:** US-002
- **Data:** 2026-09-23
- **Ambiente:** Desenvolvimento
- **Login:** https://app-develop.checkmob.com/Account/Login
- **Tela:** https://web-development.checkmob.com/cliente/lista
- **Usuário de teste:** `michaelmaia` (senha já combinada; não versionar neste arquivo)
- **Status:** Reprovado

## Pré-condições
- Usuário autenticado com permissão para consultar a lista de empresas.
- Lista de empresas aberta.
- Clientes de referência disponíveis:
  - **Aliança Consultoria** — já visitado, sem ciclo configurado.
  - **QA Ciclo 30d** (e demais QA Ciclo com intervalo) — nunca visitado, com ciclo configurado.
  - **QA Ciclo Nenhum** / **QA Ciclo nothing** — nunca visitado, sem ciclo configurado.

## Casos de teste

### CT-01 — Seção “Ciclo de visita” aparece no lugar certo, com ícone e os três campos

**Objetivo:**
Garantir que a consulta rápida na lista mostre a seção no contexto do cliente, entre Carteira e Status do negócio.

**Pré-condições:**
- Cliente com seções Carteira e Status do negócio preenchidas (ex.: Aliança Consultoria).

**Passos:**
1. Acessar a lista de empresas.
2. Clicar no cliente **Aliança Consultoria**.
3. Observar as seções do drawer de detalhes e o cabeçalho de **Ciclo de visita**.

**Resultado esperado:**
A seção colapsável **Ciclo de visita** aparece com ícone de calendário-relógio, entre **Carteira** e **Status do negócio**, e contém os campos **Última visita**, **Status** e **Intervalo**.

**Resultado obtido:**
A ordem observada foi: Dados de contato → **Carteira** → **Ciclo de visita** → **Status do negócio** → demais seções. O ícone de calendário-relógio está no cabeçalho. Os três campos estão presentes.

**Status:** Aprovado

### CT-02 — Última visita mostra data, hora e tempo decorrido, ou “Nunca visitado”

**Objetivo:**
Permitir que o gestor saiba imediatamente se o cliente já foi visitado e há quanto tempo.

**Pré-condições:**
- Um cliente já visitado e um cliente nunca visitado.

**Dados de teste:**
- Aliança Consultoria (última visita em 25/08/2026 18:54).
- QA Ciclo 30d (nunca visitado).

**Passos:**
1. Abrir o drawer de **Aliança Consultoria** e ler **Última visita**.
2. Abrir o drawer de **QA Ciclo 30d** e ler **Última visita**.

**Resultado esperado:**
- Com visita: data, hora e tempo decorrido, no formato do exemplo da história (ex.: “Terça-feira, 06/07/2026 11:30 — 45 dias atrás”).
- Sem visita: **Nunca visitado**.

**Resultado obtido:**
- Aliança Consultoria: **Terça-feira, 25/08/2026 18:54 — 28 dias atrás**.
- QA Ciclo 30d: **Nunca visitado**.

**Status:** Aprovado

### CT-03 — Status do ciclo usa os rótulos e cores combinados

**Objetivo:**
O gestor deve reconhecer rapidamente se o cliente está no prazo, em atenção ou atrasado, ou ver “—” quando não há ciclo.

**Pré-condições:**
- Cliente sem ciclo.
- Cliente com ciclo configurado.

**Dados de teste:**
- Aliança Consultoria — sem ciclo, já visitado.
- QA Ciclo Nenhum — sem ciclo, nunca visitado.
- QA Ciclo 7d / 30d / 120d / 365d — com ciclo, nunca visitado.

**Passos:**
1. Abrir o drawer de um cliente **sem** ciclo e ler **Status**.
2. Abrir o drawer de clientes **com** ciclo e ler **Status** (texto e cor).

**Resultado esperado:**
- Sem ciclo: **—**
- Com ciclo: badge **No prazo** (verde, até 90%), **Atenção** (amarelo, acima de 90% até 100%) ou **Atrasado** (vermelho, acima de 100%).

**Resultado obtido:**
- Sem ciclo: **—** (Aliança Consultoria e QA Ciclo Nenhum).
- Com ciclo e nunca visitado: o campo não mostra “Atrasado”. Mostra **“Visita atrasada · % de 30 dias”** (o número do intervalo muda conforme o cliente: 7, 30, 120, 365). O texto está vermelho, sem fundo de badge. Não foi possível observar **No prazo** nem **Atenção** nos clientes disponíveis (todos os QA Ciclo com intervalo estavam sem visita).

**Status:** Reprovado

### CT-04 — Intervalo mostra os dias configurados ou “—”

**Objetivo:**
O gestor vê, no mesmo drawer, de quantos em quantos dias o cliente deveria ser visitado.

**Passos:**
1. Abrir **QA Ciclo 30d**, **QA Ciclo 7d**, **QA Ciclo 120d** e **QA Ciclo 365d**.
2. Abrir **QA Ciclo Nenhum**.
3. Abrir **Aliança Consultoria**.

**Resultado esperado:**
- Com ciclo: intervalo no formato **“30 dias”** (ou o valor configurado).
- Sem ciclo: **—**

**Resultado obtido:**
- QA Ciclo 7d / 30d / 120d / 365d: **7 dias**, **30 dias**, **120 dias**, **365 dias**.
- Sem ciclo: **—**

**Status:** Aprovado

### CT-05 — A seção pode ser recolhida e expandida pelo cabeçalho

**Objetivo:**
O usuário controla o espaço do drawer; o chevron indica se a seção está aberta ou fechada.

**Pré-condições:**
- Drawer de detalhes aberto com a seção **Ciclo de visita** visível.

**Passos:**
1. Clicar no cabeçalho **Ciclo de visita**.
2. Verificar se os campos somem e se o chevron muda.
3. Clicar novamente no cabeçalho.

**Resultado esperado:**
O conteúdo é recolhido e depois expandido. O chevron indica o estado atual.

**Resultado obtido:**
Ao clicar, os campos **Última visita**, **Status** e **Intervalo** somem; ao clicar de novo, voltam. O indicador do cabeçalho muda de posição entre aberto e fechado.

**Status:** Aprovado

## Bugs encontrados

### BUG-01 — Status do ciclo não usa os nomes combinados e mistura o intervalo no mesmo texto

**Título:** Campo Status mostra “Visita atrasada · % de 30 dias” em vez do badge “Atrasado”

**Descrição:**
Quando o cliente tem ciclo configurado, o campo **Status** deveria mostrar só a situação do ciclo (**No prazo**, **Atenção** ou **Atrasado**), com a cor correspondente. Na prática, o campo junta a situação com o intervalo e ainda exibe o trecho **“% de”** sem o percentual. O gestor precisa interpretar um texto diferente do combinado e não vê o badge no padrão da história.

**Pré-condições:**
- Usuário autenticado na lista de empresas.
- Cliente com ciclo configurado (ex.: **QA Ciclo 30d**).

**Passos para reprodução:**
1. Acessar a lista de empresas.
2. Pesquisar **QA Ciclo**.
3. Abrir o cliente **QA Ciclo 30d**.
4. Localizar a seção **Ciclo de visita**.
5. Ler o campo **Status**.
6. Repetir com **QA Ciclo 7d** ou **QA Ciclo 120d** para ver o mesmo padrão.

**Resultado atual:**
**Status** exibe, por exemplo:
- **Visita atrasada · % de 30 dias** (QA Ciclo 30d)
- **Visita atrasada · % de 7 dias** (QA Ciclo 7d)
- **Visita atrasada · % de 120 dias** (QA Ciclo 120d)

O texto aparece em vermelho, sem o visual de badge (fundo colorido) descrito no aceite. O intervalo já existe em um campo separado.

**Resultado esperado:**
**Status** deve mostrar apenas o badge **Atrasado** (vermelho), **Atenção** (amarelo) ou **No prazo** (verde), de acordo com o percentual do ciclo. O intervalo permanece só no campo **Intervalo** (ex.: **30 dias**).

**Impacto:**
Dificulta a leitura rápida na lista: o gestor não encontra os nomes combinados, vê um “% de” incompleto e recebe a mesma informação de intervalo duas vezes, de forma confusa.

- **Severidade:** Alta
- **Status:** Aberto
- **Frequência:** Sempre (nos clientes com ciclo testados)
- **Solução alternativa:** Olhar o campo **Intervalo** para o número de dias; a cor vermelha ainda sugere atraso, mas o rótulo não é o do aceite.

**Evidências:**
- Drawer de **QA Ciclo 30d**: Última visita = Nunca visitado; Status = Visita atrasada · % de 30 dias; Intervalo = 30 dias.

<details>
<summary>Detalhes técnicos (opcional)</summary>

- Hipótese: o texto do status está montado com um rótulo diferente do aceite (“Visita atrasada”) e um trecho de percentual/intervalo mal preenchido (“% de 30 dias”), possivelmente a mesma interpolação vista na coluna da lista (`cicloDeVisita`).
- Classe observada no status: indicador de atrasado, cor de texto vermelha, sem fundo.
- Cliente sem ciclo continua exibindo “—” em Status e Intervalo, alinhado ao aceite.

</details>

## Ajustes encontrados

### AJU-01 — Na lista, a coluna de ciclo também mostra “% de X dias”

**Título do ajuste:** Na lista de empresas, a coluna de ciclo mostra “% de X dias” em vez de um valor claro.

**Actual scenario:**
Para clientes com ciclo configurado, a coluna da lista exibe textos como **“% de 30 dias”**, **“% de 7 dias”** ou equivalentes. O percentual não aparece e o intervalo fica difícil de ler.

**Expected scenario:**
A coluna deve mostrar um valor compreensível, como o intervalo (**30 dias**) ou o status do ciclo (**No prazo**, **Atenção**, **Atrasado**), sem o trecho incompleto **“% de”**.

- **Prioridade:** Média
- **Status:** Aberto

### AJU-02 — Títulos de coluna da lista ainda aparecem como chaves de tradução

**Título do ajuste:** Cabeçalhos da lista de empresas aparecem como chaves técnicas, não como nomes da tela.

**Actual scenario:**
Os títulos das colunas são exibidos como **cicloDeVisita**, **etapaDoFunil**, **categoria** e equivalentes, em vez dos nomes que o usuário espera ver.

**Expected scenario:**
Cada coluna deve mostrar o nome amigável correspondente, por exemplo **Ciclo de visita**, **Etapa do funil** e **Categoria**.

- **Prioridade:** Baixa
- **Status:** Aberto

## Evidências
- Execução em 23/09/2026 no develop, perfil autenticado como Michael Maia.
- Clientes usados: Aliança Consultoria; QA Ciclo 7d, 30d, 120d, 365d, Nenhum e nothing.

## Não coberto nesta execução
- **No prazo** e **Atenção**: não havia, na amostra testada, cliente com ciclo configurado **e** visita recente o suficiente para esses percentuais. Risco residual: as faixas de 90% e 100% e as cores verde/amarelo não foram comprovadas na interface.
- Permissão de usuário sem acesso ao drawer.
- Acessibilidade completa por teclado além do clique no cabeçalho.
