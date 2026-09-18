# Investigación rigurosa del sistema dinámico lineal planar autónomo hamiltoniano y clasificación espectral del origen

## 1. Estrategia

Investigación rigurosa y completa del sistema dinámico lineal planar autónomo hamiltoniano. Se formula matricialmente el problema, se analiza el espectro del operador lineal subyacente, se calcula explícitamente la exponencial de matriz para obtener la solución general, se determina la integral primera del sistema para hallar la geometría de las trayectorias en el espacio fase y se clasifica topológicamente el origen utilizando la teoría de sistemas dinámicos cualitativos.

Resultado analítico fundamental:
$$
X(t) = \begin{pmatrix} x(t) \\ y(t) \end{pmatrix} = \begin{pmatrix} x_0 \cos(t) + y_0 \sin(t) \\ -x_0 \sin(t) + y_0 \cos(t) \end{pmatrix}, \quad x^2 + y^2 = x_0^2 + y_0^2
$$

Interpretación: Las soluciones representan órbitas periódicas cerradas (circunferencias concéntricas recorridas en sentido horario) que demuestran que el origen es un centro estable en el sentido de Liapunov.

Comprobación analítica: Derivamos respecto al tiempo la solución obtenida. Para la primera componente: $x'(t) = -x_0 \sin(t) + y_0 \cos(t)$, lo cual coincide exactamente con la expresión de $y(t)$. Para la segunda componente: $y'(t) = -x_0 \cos(t) - y_0 \sin(t)$, lo cual es exactamente igual a $-x(t)$. Asimismo, al sustituir en la integral primera: $\frac{1}{2} (x(t)^2 + y(t)^2) = \frac{1}{2} ((x_0 \cos t + y_0 \sin t)^2 + (-x_0 \sin t + y_0 \cos t)^2) = \frac{1}{2} (x_0^2(\cos^2 t + \sin^2 t) + y_0^2(\sin^2 t + \cos^2 t)) = \frac{1}{2}(x_0^2 + y_0^2) = C$, confirmando la conservación exacta de la energía del sistema hamiltoniano.

## 2. Marco Teórico

### Álgebra Lineal y Teoría Espectral
Estudio de los espacios vectoriales de dimensión finita, operadores lineales, diagonalización y el cálculo de la exponencial de una matriz mediante la teoría de autovalores y autovectores en el cuerpo de los números complejos.

* **Teorema de Cayley-Hamilton y Exponencial Matricial**
  * **Enunciado:** Sea $A \in \mathcal{M}_n(\mathbb{R})$ una matriz con polinomio característico $p(\lambda) = \det(\lambda I - A)$. Entonces $p(A) = 0$. Además, la exponencial matricial definida por la serie de potencias convergente en toda la norma de matrices 
  $$
  e^{tA} = \sum_{k=0}^{\infty} \frac{t^k A^k}{k!}
  $$
  satisface la ecuación diferencial matricial $\frac{d}{dt} e^{tA} = A e^{tA} = e^{tA} A$.
  * **Explicación:** Este teorema fundamental permite reducir potencias arbitrarias de una matriz a polinomios de grado menor que $n$, y provee la solución analítica cerrada para sistemas de ecuaciones diferenciales ordinarias lineales con coeficientes constantes.
  * **Demostración:** Para demostrar la convergencia de la serie de potencias, se utiliza la norma matricial subordinada $\|\cdot\|$. Dado que la serie mayorante $\sum_{k=0}^{\infty} \frac{|t|^k \|A\|^k}{k!} = e^{|t|\|A\|}$ converge absolutamente para todo $t \in \mathbb{R}$, la serie de potencias de $e^{tA}$ converge uniforme y absolutamente en cualquier compacto. Derivando término a término la serie, se obtiene: 
  $$
  \frac{d}{dt} e^{tA} = \sum_{k=1}^{\infty} \frac{k t^{k-1} A^k}{k!} = A \sum_{k=1}^{\infty} \frac{t^{k-1} A^{k-1}}{(k-1)!} = A e^{tA}.
  $$
  Q.E.D. ■

### Sistemas Dinámicos y Ecuaciones Diferenciales Ordinarias
Rama de las matemáticas que analiza el comportamiento a largo plazo de sistemas gobernados por leyes deterministas, estudiando las órbitas, puntos de equilibrio, estabilidad y retratos de fase.

* **Punto Crítico y Estabilidad en el Sentido de Liapunov**
  * **Enunciado:** Un punto $X^* \in \mathbb{R}^n$ es un punto crítico (o de equilibrio) del sistema autónomo $X' = F(X)$ si $F(X^*) = 0$. El punto $X^*$ se dice estable en el sentido de Liapunov si para todo $\epsilon > 0$ existe un $\delta > 0$ tal que si $\|X(0) - X^*\| < \delta$, entonces para todo $t \ge 0$ se cumple $\|X(t) - X^*\| < \epsilon$.
  * **Explicación:** Define formalmente cuándo las perturbaciones iniciales pequeñas permanecen acotadas a lo largo del tiempo en el entorno del equilibrio, concepto fundamental para clasificar centros y sumideros.
  * **Demostración:** La formulación es estrictamente axiomática y topológica. Sea $B_\delta(X^*)$ la bola abierta de radio $\delta$ centrada en el equilibrio. La condición de estabilidad exige que el flujo $\phi_t$ satisfaga $\phi_t(B_\delta(X^*)) \subseteq B_\epsilon(X^*)$ para todo $t \ge 0$. En sistemas lineales con autovalores puramente imaginarios, las trayectorias forman elipses o circunferencias cerradas alrededor del origen, garantizando que la distancia máxima al origen se mantenga estrictamente acotada por el radio inicial, cumpliendo la definición con $\delta = \epsilon$. Q.E.D. ■

* **Clasificación Espectral del Origen en Sistemas Planares**
  * **Enunciado:** Sea el sistema lineal planar homogéneo $X' = AX$ con $A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$. Sean $\tau = \text{tr}(A) = a + d$ y $\Delta = \det(A) = ad - bc$. El origen es un centro si $\tau = 0$ y $\Delta > 0$.
  * **Explicación:** Permite clasificar cualitativamente el comportamiento del flujo en el plano fase examinando únicamente la traza y el determinante de la matriz del sistema, sin necesidad de resolverlo explícitamente en una primera instancia.
  * **Demostración:** Los autovalores de $A$ se obtienen resolviendo la ecuación característica $\det(\lambda I - A) = \lambda^2 - \tau \lambda + \Delta = 0$. Sus raíces son $\lambda_{1,2} = \frac{\tau \pm \sqrt{\tau^2 - 4\Delta}}{2}$. Si $\tau = 0$ y $\Delta > 0$, entonces $\tau^2 - 4\Delta = -4\Delta < 0$, lo que resulta en autovalores complejos conjugados puros $\lambda_{1,2} = \pm i \sqrt{\Delta}$. La presencia de parte real nula y parte imaginaria no nula genera soluciones trigonométricas acotadas (senos y cosenos), cuyas órbitas en el espacio fase son curvas cerradas (centros). Q.E.D. ■

### Geometría Simpléctica y Sistemas Hamiltonianos
Estudio de variedades diferenciables equipadas con una forma simpléctica cerrada y no degenerada, modelando la conservación de la energía y el volumen en la mecánica clásica.

* **Conservación de la Energía y Estructura Hamiltoniana**
  * **Enunciado:** El sistema lineal $x' = y$, $y' = -x$ es un sistema hamiltoniano con función de Hamilton $H(x, y) = \frac{1}{2}(x^2 + y^2)$. Las trayectorias del sistema son las curvas de nivel de la función $H$.
  * **Explicación:** Muestra que el campo vectorial deriva de una función escalar (energía total), lo que implica que el volumen en el espacio fase se conserva (divergencia nula) y las órbitas son perfectamente periódicas y cerradas.
  * **Demostración:** Consideremos la función de energía $H(x, y) = \frac{1}{2} x^2 + \frac{1}{2} y^2$. Calculamos su derivada temporal a lo largo de las trayectorias del sistema mediante la regla de la cadena: $\frac{dH}{dt} = \frac{\partial H}{\partial x} x' + \frac{\partial H}{\partial y} y'$. Sustituyendo las ecuaciones del sistema $x' = y$ y $y' = -x$:
  $$
  \frac{dH}{dt} = (x)(y) + (y)(-x) = xy - xy = 0.
  $$
  Dado que $\frac{dH}{dt} = 0$, la función $H(x, y)$ es una integral primera del movimiento. Por lo tanto, las trayectorias están confinadas a las curvas de nivel $H(x, y) = C$ (con $C \ge 0$), las cuales corresponden a circunferencias concéntricas $x^2 + y^2 = 2C$. Q.E.D. ■

## 3. Investigaciones

* **Sistemas Hamiltonianos en Variedades Simplécticas de Dimensión $2n$**
  * **Desarrollo:** El sistema planar estudiado es un caso particular de los sistemas hamiltonianos definidos en un espacio fase de dimensión par $\mathbb{R}^{2n}$, dotado de una forma simpléctica estándar $\omega = \sum_{i=1}^n dp_i \wedge dq_i$. Las ecuaciones de Hamilton se expresan como $\dot{q} = \frac{\partial H}{\partial p}$ y $\dot{p} = -\frac{\partial H}{\partial q}$. La conservación de la energía $H(q, p) = \text{constante}$ generaliza la integral primera $x^2 + y^2 = \text{constante}$, confinando las trayectorias a subvariedades de nivel llamadas superficies de energía.

* **Ecuaciones Diferenciales en Espacios de Banach de Dimensión Infinita**
  * **Desarrollo:** Cuando el espacio de estados no es $\mathbb{R}^2$ sino un espacio de Hilbert o de Banach (por ejemplo, $L^2(\Omega)$), el sistema lineal se transforma en una ecuación diferencial abstracta de evolución $\frac{du}{dt} = Au$, donde $A$ es un operador lineal cerrado no acotado que genera un Cero-grupo de operadores de clase $C_0$, denotado por $e^{tA}$, gracias al Teorema de Hille-Yosida.

## 4. Bibliografía

* Hirsch, M. W., Smale, S., & Devaney, R. L. - *Differential Equations, Dynamical Systems, and an Introduction to Chaos* (Libro). Referencia clásica y rigurosa para la teoría cualitativa de sistemas dinámicos y la linealización.
* Perko, L. - *Differential Equations and Dynamical Systems* (Libro). Excelente tratamiento analítico de los puntos críticos, sistemas lineales y bifurcaciones en el plano.
