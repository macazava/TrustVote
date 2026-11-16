
# Memória Descritiva

## 1. Identificação

**Nome do projeto:** TrustVote – Sistema Distribuído de Votação Online  
**Curso:** Licenciatura em Engenharia Informática  
**Ano letivo:** 2026/2027  
**Semestre:** 5.º Semestre  
**Unidades Curriculares:** Projeto de Desenvolvimento de Software; Engenharia de Software; Segurança Informática; Sistemas Distribuídos; Inteligência Artificial  
**Docentes:** Miguel Boavida; Rui Ramos; Sérgio Nunes; Pedro Rosa; Samuel Gomes

### Elementos do grupo

- Fábio Alexandre Rómulo Teixeira — 20241821
- Feliciano Batila Barata — 20240722
- Maria Camila Zamorano Vargas — 20240999
- Taha-Wur Abbass Faquir Pereira — 20241694

### Palavras-chave

Votação Online; Eleições da Associação de Estudantes; Sistemas Distribuídos; Segurança Informática; Tolerância a Falhas; Criptografia; Integridade de Dados; Auditoria; Docker; Python; PostgreSQL; Redis.

---

## 2. Resumo

O TrustVote é uma plataforma distribuída de votação online desenvolvida no âmbito da Licenciatura em Engenharia Informática, destinada a apoiar a realização das eleições da Associação de Estudantes da Universidade Europeia.

A solução disponibiliza uma aplicação web que permite aos estudantes participar nos processos eleitorais para os quais estão habilitados, enquanto os administradores podem configurar e gerir as eleições, os órgãos sociais e os respetivos candidatos.

O projeto assenta numa arquitetura distribuída, executada através de containers Docker, que integra duas instâncias do backend, um servidor Nginx e uma infraestrutura PostgreSQL com uma instância principal e uma réplica. Inclui ainda mecanismos de monitorização e failover, procurando assegurar a continuidade dos serviços perante falhas isoladas.

O desenvolvimento recorre a Python e FastAPI no backend, HTML, CSS e JavaScript no frontend, PostgreSQL para o armazenamento persistente e Redis para funcionalidades de suporte, como a revogação de tokens e a limitação de tentativas de autenticação.

Ao nível funcional, a plataforma contempla mecanismos de autenticação, gestão eleitoral, validação da elegibilidade dos estudantes, submissão de votos, prevenção de participações duplicadas e emissão de recibos verificáveis. O projeto integra conhecimentos de Engenharia de Software, Segurança Informática e Sistemas Distribuídos, mantendo também uma componente de exploração de Inteligência Artificial.

---

## 3. Contexto

A crescente digitalização de serviços e processos tem impulsionado o desenvolvimento de soluções capazes de disponibilizar diferentes atividades através de plataformas online. No contexto eleitoral, estas soluções podem simplificar a organização e participação nos processos de votação, exigindo, contudo, garantias de segurança, confidencialidade, integridade e disponibilidade da informação.

É neste contexto que surge o TrustVote, uma plataforma desenvolvida para apoiar as eleições da Associação de Estudantes da Universidade Europeia. A solução procura centralizar as diferentes etapas do processo eleitoral, desde a gestão das eleições até à participação dos estudantes e consulta dos resultados.

A natureza do projeto exige especial atenção à proteção dos votos, à prevenção de participações duplicadas e à capacidade de funcionamento perante falhas. Para responder a estes desafios, o TrustVote combina mecanismos de segurança com uma arquitetura distribuída, redundância de serviços e replicação da base de dados.

---

## 4. Processo

O desenvolvimento do TrustVote foi realizado de forma progressiva e colaborativa, envolvendo a definição dos requisitos, a conceção da arquitetura, a implementação das funcionalidades e a integração dos diferentes componentes.

A aplicação foi desenvolvida com HTML, CSS e JavaScript no frontend e Python, através do framework FastAPI, no backend. A comunicação entre os componentes é assegurada através de uma API, com o Nginx como ponto de entrada da aplicação.

A infraestrutura utiliza Docker e Docker Compose para organizar os serviços, integrando duas instâncias do backend, PostgreSQL com uma configuração Primary/Replica, um monitor de failover e Redis. O acesso à aplicação é disponibilizado através de HTTPS.

Ao nível funcional, foram desenvolvidos mecanismos de registo e autenticação com JWT, proteção de palavras-passe com Argon2, gestão de eleições e candidatos, validação da elegibilidade dos estudantes e processo de votação. A participação e o voto são registados na mesma transação, mantendo separados os dados de identificação do eleitor e a sua escolha eleitoral.

A equipa utiliza o GitHub para controlo de versões e colaboração no desenvolvimento e o ClickUp para organização e acompanhamento das tarefas.

---

## 5. Resultados

O desenvolvimento do TrustVote permitiu concretizar uma plataforma web com funcionalidades de autenticação, gestão eleitoral, validação da elegibilidade dos estudantes, submissão de votos e consulta de resultados.

Ao nível da infraestrutura, foi implementada uma arquitetura distribuída com duas instâncias da API, encaminhamento de pedidos através do Nginx, replicação PostgreSQL e mecanismos de monitorização e failover. O Redis encontra-se integrado em funcionalidades de suporte à autenticação.

Foram também desenvolvidos mecanismos de prevenção de votos duplicados, registo transacional da participação e do voto e emissão de recibos verificáveis.

O projeto contempla ainda um modelo de falhas que identifica os principais cenários de indisponibilidade, os mecanismos de deteção e recuperação e as garantias de consistência dos dados. A validação da arquitetura é apoiada por testes que simulam falhas nos componentes da infraestrutura.

Apesar dos resultados alcançados, continuam previstas melhorias relacionadas com auditoria, integridade eleitoral, novas funcionalidades, testes e preparação da plataforma para uma eventual utilização em contexto real.

---

## 6. Reflexão

O desenvolvimento do TrustVote permitiu aplicar e consolidar conhecimentos de diferentes áreas da Engenharia Informática, proporcionando experiência prática na conceção, implementação e integração de uma aplicação distribuída.

Um dos principais desafios consistiu em conciliar os requisitos funcionais da votação com as exigências de segurança, integridade e tolerância a falhas. A implementação de componentes redundantes, replicação da base de dados e mecanismos de recuperação permitiu aprofundar a compreensão sobre o funcionamento e os desafios dos sistemas distribuídos.

O trabalho colaborativo foi também fundamental para a integração das diferentes componentes, exigindo organização, controlo de versões e coordenação entre os elementos da equipa.

Nas próximas fases, pretende-se continuar a evoluir a plataforma através da implementação de mecanismos de auditoria, reforço da integridade dos votos, desenvolvimento de novas funcionalidades e realização de testes adicionais. O objetivo é consolidar uma solução mais robusta, fiável e preparada para uma eventual utilização em contexto eleitoral real.
