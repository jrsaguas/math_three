# Investigación Rigorosa del Sistema Dinámico Lineal Plano: $X' = A X$

## 1. Estrategia
La estrategia analítica consiste en reformular el problema clásico como un sistema dinámico lineal en espacios de Banach y aplicar la teoría espectral. Primero, calcularemos el polinomio característico de la matriz $A$ para obtener su espectro $\sigma(A)$. A continuación, dado que $A$ carece de valores propios reales, utilizaremos la exponencial matricial $e^{At}$ mediante la fórmula de Euler para matrices, aprovechando que $A^2 = -I$. Derivaremos la solución general explícita, analizaremos las integrales primas del movimiento para demostrar que las trayectorias son circunferencias concéntricas, y finalmente aplicaremos la teoría de Lyapunov para clasificar el origen como un centro neutro estables en el sentido de Lyapunov pero no asintóticamente estable.

### Resultado analítico obtenido:
$$
X(t) = \begin{pmatrix} \cos(t) & \sin(t) \\ -\sin(t) & \cos(t) \end{pmatrix} X_0, \quad x^2 + y^2 = R^2
$$

### Verificación analítica:
Sustituyendo la solución propuesta en las EDOs originales: $\frac{d}{dt}[x(t)] = -x_0 \sin(t) + y_0 \cos(t) = y(t)$ y $\frac{d}{dt}[y(t)] = -x_0 \cos(t) - y_0 \sin(t) = -x(t)$, lo cual verifica idénticamente el sistema. La derivada de la función de Lyapunov da cero, confirmando la existencia de órbitas cerradas.

---

## 2. Marco Teórico

### Álgebra Lineal Avanzada
Estudio de espacios vectoriales de dimensión finita sobre el cuerpo de los números complejos, operadores lineales, espectro matricial y la exponencial de matrices.

- **Definición: Exponencial de una Matriz**
  Enunciado formal:
  $$
  e^{A} = \sum_{k=0}^{\infty} \frac{A^k}{k!} = I + A + \frac{A^2}{2!} + \frac{A^3}{3!} + \dots
  $$
  Explicación: Sea $A \in M_n(\mathbb{C})$ una matriz cuadrada de orden $n$. La serie matricial converge absolutamente en la norma inducida para cualquier matriz $A$, debido a la completitud del espacio de Banach $M_n(\mathbb{C})$. Esta herramienta fundamental permite resolver sistemas de EDOs lineales homogéneos mapeando el álgebra de Lie de matrices al grupo de Lie general lineal $GL(n, \mathbb{C})$.
  
  Demostración formal: La convergencia absoluta se demuestra utilizando la desigualdad submultiplicativa de la norma matricial $\|AB\| \leq \|A\|\|B\|$, lo que permite acotar la serie de la exponencial por la serie exponencial real del escalar $\|A\|$, la cual converge uniformemente en compactos de $\mathbb{R}$.

- **Teorema: Teorema de Cayley-Hamilton y Reducción Espectral**
  Enunciado formal: Sea $A \in M_2(\mathbb{R})$ con polinomio característico $p(\lambda) = \det(\lambda I - A) = \lambda^2 - \text{tr}(A)\lambda + \det(A)$. Entonces $p(A) = 0$. Si $A = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix}$, entonces $A^2 = -I$.
  
  Explicación: El teorema establece que toda matriz cuadrada anula su propio polinomio característico. Para la matriz del sistema en cuestión, la traza es $\text{tr}(A) = 0$ y el determinante es $\det(A) = 1$. Por ende, $A^2 + I = 0$, lo que implica que las potencias superiores de $A$ se reducen cíclicamente: $A^3 = -A$, $A^4 = I$, permitiendo calcular explícitamente $e^{At}$ mediante la expansión en serie sin necesidad de diagonalización en $\mathbb{R}$.
  
  Demostración formal: Se evalúa directamente la matriz $A = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix}$. Calculando el cuadrado mediante el producto interno canónico de filas por columnas:
  $$
  A^2 = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix} \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix} = \begin{pmatrix} 0(0)+1(-1) & 0(1)+1(0) \\ -1(0)+0(-1) & -1(1)+0(0) \end{pmatrix} = \begin{pmatrix} -1 & 0 \\ 0 & -1 \end{pmatrix} = -I
  $$
  Por ende, $A^2 + I = 0$, verificando idénticamente el teorema de Cayley-Hamilton para la dimensión $n=2$. $\blacksquare$

### Análisis Cualitativo de Ecuaciones Diferenciales
Teoría de estabilidad de Lyapunov, clasificación topológica de puntos críticos en el plano y análisis de flujos autónomos.

- **Definición: Centro Lineal (Punto Crítico No Hiperbólico)**
  Enunciado formal: Un punto crítico $X^* = 0$ de un sistema dinámico lineal $X' = AX$ se denomina centro si los eigenvalores de la matriz $A$ son puramente imaginarios conjugados, es decir, $\sigma(A) = \{\pm i\beta\}$ con $\beta \in \mathbb{R} \setminus \{0\}$.
  
  Explicación: En un centro, el flujo del sistema confina las trayectorias a órbitas cerradas (periodicidad orbital) en entornos perforados del origen. El origen es estable en el sentido de Lyapunov, pero no asintóticamente estable, ya que las soluciones ni convergen al origen ni divergen de él conforme $t \to \infty$.
  
  Demostración formal: Dado que $\text{tr}(A) = 0$ y $\det(A) > 0$, las raíces de la ecuación característica son complejos puros $\lambda = \pm i\beta$. La matriz de transición de fase está dada exactamente por $e^{At} = \cos(\beta t)I + \frac{1}{\beta}\sin(\beta t)A$, la cual es periódica con período fundamental $T = \frac{2\pi}{\beta}$. Por ende, toda órbita con $X_0 \neq 0$ es cerrada y no colapsa hacia el origen. $\blacksquare$

- **Teorema: Estabilidad según Lyapunov**
  Enunciado formal: Sea $V: \Omega \to \mathbb{R}$ una función continuamente diferenciable en un entorno $\Omega$ del origen tal que $V(0) = 0$ y $V(X) > 0$ para todo $X \neq 0$ en $\Omega$ (función de Lyapunov estricta). Si la derivada temporal a lo largo de las trayectorias satisface $\dot{V}(X) = \nabla V(X) \cdot AX \leq 0$ en $\Omega$, entonces el origen es estable en el sentido de Lyapunov.
  
  Explicación: La función de Lyapunov actúa como una generalización de la energía total del sistema físico. Si la energía no decrece ni crece (es decir, se conserva con $\dot{V} = 0$), el sistema es conservativo y las trayectorias permanecen acotadas sobre superficies de nivel constante.
  
  Demostración formal: Consideremos la función de energía cinética potencial combinada $V(x, y) = \frac{1}{2}(x^2 + y^2)$. Su derivada a lo largo del flujo $X' = (y, -x)^T$ es calculada por la regla de la cadena multivariable:
  $$
  \dot{V} = \frac{\partial V}{\partial x} \dot{x} + \frac{\partial V}{\partial y} \dot{y} = x(y) + y(-x) = xy - xy \equiv 0
  $$
  Dado que $\dot{V}(x, y) = 0$ para todo $(x, y) \in \mathbb{R}^2$, la función $V(x(t), y(t)) = V(x_0, y_0)$ es constante en el tiempo. Las trayectorias están confinadas a las curvas de nivel circulares $x^2 + y^2 = R^2$, lo que demuestra formalmente la estabilidad de Lyapunov del punto de equilibrio en el origen. $\blacksquare$

### Topología Diferencial
Estructura de variedades diferenciables, campos vectoriales, flujos y conservación de volúmenes en el espacio de fases.

- **Teorema: Teorema de Liouville para Sistemas Dinámicos Conservativos**
  Enunciado formal: Sea $X' = F(X)$ un sistema autónomo en una variedad diferenciable $\mathcal{M}$. La divergencia del campo vectorial denotada por $\nabla \cdot F = \text{tr}(DF)$ mide la tasa de cambio infinitesimal de los volúmenes en el espacio de fases según la relación:
  $$
  \frac{d}{dt} \text{vol}(\Omega(t)) = \int_{\Omega(t)} (\nabla \cdot F) \, dV
  $$
  Explicación: Cuando el campo vectorial es divergencia nula ($\nabla \cdot F = 0$), el flujo preserva el volumen de Lebesgue en el espacio de fases (teorema de Liouville en mecánica estadística y dinámica hamiltoniana).
  
  Demostración formal: Para el sistema lineal $x' = y$ y $y' = -x$, el campo vectorial es $F(x,y) = (y, -x)^T$. Su matriz Jacobiana es $DF(x,y) = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix}$. La divergencia es la traza de esta matriz:
  $$
  \nabla \cdot F = \frac{\partial (y)}{\partial x} + \frac{\partial (-x)}{\partial y} = 0 + 0 = 0
  $$
  Integrando sobre cualquier conjunto boreliano medible $\Omega_0 \subset \mathbb{R}^2$:
  $$
  \frac{d}{dt} \text{Área}(\phi_t(\Omega_0)) = \int_{\phi_t(\Omega_0)} (\nabla \cdot F) \, dxdy = 0 \implies \text{Área}(\phi_t(\Omega_0)) = \text{Área}(\Omega_0), \quad \forall t \in \mathbb{R}
  $$
  Por lo tanto, el flujo preserva estrictamente el área de Lebesgue en el plano fase $\mathbb{R}^2$. $\blacksquare$

---

## 3. Generalizaciones e Investigaciones Avanzadas

### Sistemas Lineales de Dimensión Arbitraria y Exponencial de Matrices
Considere el sistema lineal homogéneo de dimensión $n$, dado por
$$
X'(t) = A X(t)
$$
donde $A \in M_n(\mathbb{R})$ y $X: \mathbb{R} \to \mathbb{R}^n$. La teoría espectral demuestra que la solución única con condición inicial $X(0) = X_0$ se expresa mediante la exponencial de matrices
$$
X(t) = e^{At} X_0 = \sum_{k=0}^{\infty} \frac{A^k t^k}{k!} X_0
$$
Si la matriz $A$ no es diagonalizable, se recurre a la forma canónica de Jordan $A = P J P^{-1}$ para descomponer el espacio en subespacios invariantes generalizados asociados a bloques de Jordan elementales $J_i = \lambda_i I + N_i$.

### Sistemas Hamiltonianos en Variedades Simplécticas
El caso estudiado donde $A = \begin{pmatrix} 0 & 1 \\ -1 & 0 \end{pmatrix}$ corresponde a un sistema hamiltoniano lineal con función de Hamilton $H(x, y) = \frac{1}{2}(x^2 + y^2)$. Esto se generaliza a variedades simplécticas $(\mathcal{M}, \omega)$ de dimensión $2n$, donde las ecuaciones de movimiento se rigen por campos vectoriales hamiltonianos $X_H$ definidos mediante la condición intrínseca:
$$
\iota_{X_H} \omega = dH
$$
donde $\omega$ es la forma simpléctica cerrada y no degenerada $\omega = \sum_{i=1}^n dq^i \wedge dp_i$.

---

## 4. Bibliografía Rigurosa
* **Morris W. Hirsch, Stephen Smale, y Robert L. Devaney**: *Differential Equations, Dynamical Systems, and an Introduction to Chaos*. Academic Press. Referencia clásica fundamental para la teoría cualitativa de sistemas dinámicos y el análisis geométrico del espacio de fases.
* **Lawrence C. Evans**: *An Introduction to Mathematical Optimal Control Theory*. American Mathematical Society. Profundización rigurosa en propiedades de flujos, control lineal y ecuaciones de evolución en espacios euclidianos y de Hilbert.
* **Vladimir I. Arnold**: *Mathematical Methods of Classical Mechanics*. Springer-Verlag. Obra cumbre de la geometría simpléctica y sistemas hamiltonianos.
