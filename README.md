# TrustVote — Sistema de Votação Online Distribuído

**Projeto académico | Universidade Europeia — IADE**\
**Licenciatura em Engenharia Informática | Ano letivo 2026/2027 | 5.º semestre**

## Sobre o projeto

O **TrustVote** é um projeto académico desenvolvido no âmbito da Licenciatura em Engenharia Informática da Universidade Europeia, no contexto do IADE.

O projeto tem como objetivo conceber e desenvolver um sistema de votação online baseado numa arquitetura distribuída, integrando conhecimentos de Engenharia de Software, Segurança Informática, Sistemas Distribuídos e Inteligência Artificial.

Este repositório reúne o código-fonte, a documentação técnica, os diagramas, os testes e os restantes artefactos produzidos ao longo do desenvolvimento do projeto.

## Organização do repositório

A estrutura do repositório foi organizada para separar o desenvolvimento da aplicação da documentação académica, facilitando a navegação, a manutenção do código e o acompanhamento da evolução do projeto.

A organização documental segue a estrutura definida no briefing académico da unidade curricular de Projeto de Desenvolvimento de Software, incluindo diretórios específicos para a identificação do projeto, memória descritiva, imagens, vídeos, documentação técnica, artefactos, dados de investigação e autorizações.

## Objetivos técnicos

- Desenvolver uma solução de votação online com utilizadores autenticados.
- Explorar uma arquitetura distribuída com múltiplas instâncias de serviços.
- Estudar e implementar mecanismos de redundância e tolerância a falhas.
- Aplicar princípios de segurança, integridade dos votos e prevenção de votos duplicados.
- Integrar uma componente de Inteligência Artificial.
- Documentar e testar as decisões arquiteturais e os mecanismos implementados.

## Contexto académico

Este projeto é desenvolvido para fins académicos e experimentais, no âmbito das unidades curriculares do 5.º semestre da Licenciatura em Engenharia Informática, durante o ano letivo de 2026/2027.

O sistema destina-se a cenários de votação definidos para o projeto, não devendo ser considerado um sistema certificado para eleições oficiais.

## Arquitetura do repositório

```
TrustVote/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── 00_Identificacao/
│   └── info.md
│
├── 01_Memoria_Descritiva/
│   └── memoria.md
│
├── 02_Imagens/
│   ├── img_01.png
│   ├── img_02.png
│   └── ...
│
├── 03_Videos/
│   ├── demonstracao.mp4
│   └── apresentacao.mp4
│
├── 04_Documentacao_Tecnica/
│   ├── arquitetura/
│   │   ├── arquitetura_geral.md
│   │   └── arquitetura_distribuida.md
│   │
│   ├── diagramas_uml/
│   │   ├── casos_de_uso/
│   │   ├── classes/
│   │   └── sequencia/
│   │
│   ├── base_de_dados/
│   │   ├── modelo_conceptual.md
│   │   └── modelo_logico.md
│   │
│   ├── modelo_de_faltas.md
│   ├── requisitos.md
│   └── testes/
│       ├── testes_funcionais.md
│       └── testes_tolerancia_falhas.md
│
├── 05_Artefactos/
│   ├── prototipos/
│   └── recursos/
│
├── 06_Dados_Investigacao/
│   └── README.md
│
├── 07_Autorizacoes/
│   └── README.md
│
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│
├── backend/
│   ├── api/
│   ├── services/
│   ├── models/
│   ├── repositories/
│   ├── middleware/
│   └── config/
│
├── distributed/
│   ├── load_balancer/
│   ├── service_instances/
│   ├── replication/
│   ├── health_checks/
│   └── recovery/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
│
├── ai/
│   ├── data/
│   ├── models/
│   ├── training/
│   └── predictions/
│
├── security/
│   ├── authentication/
│   ├── encryption/
│   └── audit_logs/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── distributed/
│   ├── security/
│   └── fault_tolerance/
│
└── scripts/
    ├── start.sh
    ├── stop.sh
    └── health_check.sh
```
