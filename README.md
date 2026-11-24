# DECAM – Jahu/SP

Preenchimento local da **Declaração Cadastral Municipal (DECAM)** da Prefeitura de Jahu – SP, com geração de PDF no layout do formulário oficial.

Feito só com **HTML, CSS e JavaScript puros**, sem framework, sem build e sem backend. Os dados digitados **não são gravados nem enviados a nenhum servidor**; ficam apenas na memória da página.

## Funcionalidades

- Formulário em duas páginas A4, seguindo o modelo oficial (campos da empresa, localização, Junta Comercial/Cartório, contador, atividades, sócios e signatário).
- **CNPJ:** ao digitar um CNPJ válido, os dados da empresa são buscados na [ReceitaWS](https://www.receitaws.com.br/) e preenchem razão social, fantasia, endereço, contato, capital social e atividades (principal e secundárias).
- **CPF:** preenchimento totalmente manual. Com 11 dígitos, o tipo de contribuinte é marcado como Pessoa física.
- **Sócios:** cadastro manual por modal, listados na página 2 (máximo de 6, o espaço do formulário). É possível editar e remover.
- **CEP no modal de sócios:** consulta ao [ViaCEP](https://viacep.com.br/) e preenchimento automático de endereço, bairro e cidade.
- **Gerar PDF:** usa a impressão do navegador com CSS para A4, sem margens e sem cabeçalho/rodapé. O nome do arquivo sugerido é `DECAM - <Razão Social>`.
- Máscaras para CPF, CNPJ, CEP e datas, e validação dos dígitos do CNPJ antes de consultar a API.

## Estrutura

```
.
├── docs/
│   └── decam_atualizada_2023.pdf   # documento oficial padrão da prefeitura (referência)
└── src/
    ├── index.html                  # estrutura do formulário e do modal
    ├── decam.css                   # estilo de tela e de impressão (A4)
    └── decam.js                    # máscaras, consultas CNPJ/CEP, sócios e PDF
```

## Como usar

1. Abra `src/index.html` no navegador ou publique a pasta `src/` em qualquer servidor estático.
2. Informe o CNPJ ou CPF no campo **CNPJ/CPF**. Com CNPJ, os dados são carregados sozinhos. Complete o que faltar.
3. Na página 2, clique em **+ Adicionar sócio** e preencha o modal. Ao digitar o CEP, o endereço é completado.
4. Clique em **Gerar PDF** e, na janela de impressão, escolha **Salvar como PDF**.

Para testar localmente com um servidor, se preferir:

```bash
cd src
python3 -m http.server 8080
# abra http://localhost:8080
```

## Observações técnicas

- **CORS da ReceitaWS:** a API não envia o cabeçalho `Access-Control-Allow-Origin`, então o `fetch` é bloqueado pelo navegador. A consulta usa **JSONP** (`?callback=`), que a ReceitaWS aceita e que funciona inclusive abrindo o arquivo direto do disco (`file://`). Se o JSONP falhar, o código tenta o `fetch` comum como alternativa.
- **Limite da ReceitaWS:** o plano gratuito permite cerca de 3 consultas por minuto. Se aparecer erro após várias consultas seguidas, aguarde um pouco.
- **Privacidade:** as únicas requisições externas são a consulta do CNPJ (ReceitaWS) e a do CEP (ViaCEP). Nenhum dado do formulário é armazenado.
- **PDF:** o PDF é gerado pela impressão do navegador. Para um download direto, sem a janela de impressão, seria necessário adicionar uma biblioteca como jsPDF ou html2pdf.js.
- **Campo de atividades:** a caixa de texto cresce conforme o conteúdo. Textos muito longos podem empurrar a página 1 para uma terceira folha.

## Personalização

- **Layout:** a grade do formulário usa 12 colunas. Ajuste larguras com as classes `.s1` a `.s12` e `.f` em `src/decam.css`.
- **Número de sócios:** altere `MAX_SOCIOS` em `src/decam.js` (e confira se o layout da página 2 comporta).
- **Novo formulário da prefeitura:** se o modelo oficial mudar, use o PDF em `docs/` como referência e atualize os campos em `src/index.html`.

## Aviso

Projeto independente, sem vínculo com a Prefeitura Municipal de Jahu. O PDF gerado reproduz o modelo de `docs/decam_atualizada_2023.pdf`; confira sempre com a versão vigente exigida pelo Departamento de Tributação antes de protocolar.

## Licença

Distribuído sob a licença [MIT](LICENSE). O PDF em `docs/` é um documento da prefeitura e não é coberto por esta licença.
