# Missão Farda — Cris Andrade

Versão refinada do gerador de plano de estudos PMBA.

## Principais melhorias

- Distribuição dos assuntos baseada em:
  - dificuldade informada pela aluna;
  - nível atual: iniciante, intermediário ou avançado;
  - peso da matéria no edital;
  - quantidade de dias até a prova;
  - carga horária disponível.
- Cronograma com técnica Pomodoro.
- Assuntos difíceis aparecem com mais frequência.
- Assuntos fáceis entram como manutenção para evitar esquecimento.
- PDF/impressão mais organizado, com capa, diagnóstico, prioridades e cronograma.

## Como rodar no Windows

```powershell
npm.cmd install
node server.js
```

Acesse:

```text
http://localhost:3000
```

## Curso completo

O link do botão de compra fica no arquivo `server.js`:

```js
const COURSE_URL = process.env.COURSE_URL || "https://web.concurseiroelitelp.com.br/cursos-do-elite-parceiros-cris-andrade/";
```

## Leads

Os leads ficam salvos em:

```text
data/leads.csv
```
