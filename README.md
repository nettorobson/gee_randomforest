# gee_randomforest
Supervised classification of agricultural areas in a region of Brazil, applying the Random Forest classifier to Sentinel-2 satellite imagery. Coded in JavaScript for the Google Earth Engine (GEE) IDE.

:BR:

PROJETO
Classificação supervisionada de áreas de agricultura em imagens de satelite Sentinel-2 usando o classificador Random Forest.

OBJETIVOS
- Criação de mosaicos para os anos de 2017 e 2023;
- Treinamento, classificação e validação do modelo;
- Cálculo de acurácia do modelo a partir da Matriz de Confusão;
- Análise histórica das áreas ocupadas de agricultura;
- Renderização dos mapas classificados e demais produtos. 

CONCLUSÕES PRELIMINARES
- A alta acurácia de treinamento (99.42%) indica que o modelo está se ajustando bem aos dados de treino, com baixos erros de classificação. 
A quantidade muito pequena de falsos positivos (2 e 0) e falsos negativos (1 e 3) indica a confiança nos resultados obtidos.

- Para a validação, a acurácia de 97.14% também é alta, indicando que o modelo de Random Forest está desempenhando muito bem na classificação das áreas como agricultura. 
A quantidade de falsos positivos (1) e falsos negativos (4) é baixa reforça a confiança nos resultados.

- A combinação da alta acurácia de treinamento e de validação podem indicar que o modelo está generalizando bem, e que não está sobreajustado (overfitting).

- Com base na classificação, a área ocupada por agricultura no ano de 2023 aumentou 6,24 % em comparação com o ano de 2017, avançando de 26.258,22 km² para 27.897,09 km². 
Este percentual representa 1.639 km² adicionais de áreas convertidas para agricultura durante o período.


PRÓXIMAS ETAPAS e OPORTUNIDADES DE MELHORIA
- Utilização/exploração do dataset do Dynamic World para a classificação das áreas (DW possui alto potencial de uso para este tipo de problema. 
Além da boa resolução temporal, e de possuir resolução espacial de 10m (como as Imagens Sentinel-2 utilizadas neste script) utiliza sólidas fontes de dados, entre elas, o Mapbiomas, que possui com classificação personalizada e particularizada para o território brasileiro; 
- Utilização/classificação de outras categorias de uso e ocupação do solo, visando enriquecer a análise.
- Criação de séries temporais e gráficos de NDVI, visando maior precisão na coleta de amostras e classificação;  
- Geração de métricas complementares de desempenho do modelo, como a precisão e o recall, por exemplo;
- Cálculo da importância de cada banda no processamento feito pelo algoritmo;
- Fine tuning/paramater tuning: Ajuste dos parâmetros e ajuste fino do modelo para otimizar a acurácia e as demais métricas;
- Geração de mapas dinâmicos/animados indicando a evolução anual das classes-alvo;
- Aplicação de nova camada de refatoração;
- Testes finais;
- Revisão e refinamento da documentação;
