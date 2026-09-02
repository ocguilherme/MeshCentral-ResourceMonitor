# MeshCentral Resource Monitor

Plugin para MeshCentral que coleta CPU e memória dos agentes e apresenta histórico em uma aba do dispositivo.

## Recursos

- coleta a cada 5 minutos;
- CPU e memória em percentual;
- armazenamento no banco interno do MeshCentral;
- períodos de 24h, 7 dias, 30 dias e personalizado;
- gráfico simples em linha;
- médias para períodos longos para evitar excesso de pontos no navegador.

## Instalação

1. Ative plugins no `meshcentral-data/config.json`:

```json
"settings": {
  "plugins": { "enabled": true }
}
```

1. Em **My Server > Plugins > Download Plugin**, informe a URL do `config.json` raw.
2. Ative o plugin e reinicie o MeshCentral.

Os agentes precisam receber um novo MeshCore contendo o módulo do plugin antes de começarem a enviar dados. Plugins do MeshCentral podem incluir módulos em `modules_meshcore`, como ocorre em plugins existentes.

## Banco

É criado um documento por nó por dia, com as amostras dentro do campo `samples`.

## Observação

Esta é a versão inicial. O armazenamento está propositalmente simples para validar a coleta, comunicação e visualização antes de adicionar retenção, agregação persistente e administração.
