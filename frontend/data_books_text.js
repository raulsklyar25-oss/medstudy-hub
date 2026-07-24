// Detailed Textbook content database for MedStudy Hub Textbook Reader
if (!window.MedData) window.MedData = {};

window.MedData.textbooks = {
  // --- ANATOMY BOOKS ---
  sapin_anatomy: {
    id: "sapin_anatomy",
    subjectId: "anatomy",
    title: "Анатомия человека",
    author: "М.Р. Сапин",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Введение в анатомию и оси тела",
        content: `
          <p><b>Анатомия человека</b> — наука о строении и форме человеческого тела в связи с его функциями, развитием и влиянием условий внешней среды. Изучение строения тела проводится на живом человеке, на трупах, а также путем клинико-анатомических сопоставлений с использованием рентгенологических, ультразвуковых и томографических методов исследования.</p>
          <p>Для определения положения органов в теле человека используют оси и плоскости:</p>
          <ul>
            <li><b>Сагиттальная плоскость (planum sagittale):</b> делит тело на правую и левую половины.</li>
            <li><b>Фронтальная плоскость (planum frontale):</b> параллельна лбу, делит тело на переднюю и заднюю части.</li>
            <li><b>Горизонтальная плоскость (planum horizontale):</b> разделяет тело на верхнюю и нижнюю части.</li>
          </ul>
          <p>Соответственно плоскостям выделяют три оси вращения: вертикальную, фронтальную и сагиттальную, вокруг которых совершаются движения в суставах. Ключевые термины положения органов включают: <i>медиальный</i> (ближе к срединной линии), <i>латеральный</i> (боковой), <i>проксимальный</i> (ближе к началу конечности) и <i>дистальный</i> (удаленный).</p>
        `
      },
      {
        title: "Глава 2: Анатомия сердечно-сосудистой системы и гемодинамика плода",
        content: `
          <p><b>Сердце (cor)</b> — полый мышечный орган, выполняющий насосную функцию в кровеносной системе. Масса сердца составляет в среднем 0.5% от массы тела человека (около 250 г у женщин и 300 г у мужчин).</p>
          
          <h4>1. Внешнее строение и поверхности</h4>
          <p>У сердца различают верхушку (<i>apex cordis</i>), направленную вниз, вперед и влево (проецируется в V межреберье на 1-1.5 см кнутри от левой среднеключичной линии), и основание (<i>basis cordis</i>), обращенное вверх, назад и вправо.</p>
          <p>Выделяют три основные поверхности:</p>
          <ul>
            <li><b>Грудино-реберная поверхность:</b> обращена к передней стенке грудной клетки.</li>
            <li><b>Диафрагмальная поверхность:</b> прилежит к сухожильному центру диафрагмы.</li>
            <li><b>Легочные поверхности:</b> обращены к правому и левому легким.</li>
          </ul>

          <h4>2. Топография и Средостение (BNA vs PNA)</h4>
          <p>Сердце располагается в грудной полости внутри околосердечной сумки (перикарда). Классификация положения сердца в средостении:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.05);">
                <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Параметр</th>
                <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Базельская классификация (BNA)</th>
                <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Парижская классификация (PNA)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1);"><b>Деление</b></td>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1);">Фронтальная плоскость (позади корней легких) делит на переднее и заднее.</td>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1);">Горизонтальная плоскость делит на верхнее и нижнее. Нижнее делится на переднее, среднее и заднее.</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1);"><b>Положение сердца</b></td>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); font-weight: bold; color: var(--accent-cyan);">Переднее средостение</td>
                <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); font-weight: bold; color: var(--accent-pink);">Среднее средостение (вместе с перикардом)</td>
              </tr>
            </tbody>
          </table>

          <h4>3. Оболочки сердца и клапанный аппарат</h4>
          <p>Стенка сердца состоит из трех слоев:</p>
          <ul>
            <li><b>Эндокард (endocardium):</b> внутренняя выстилка из эндотелия, образующая створки клапанов.</li>
            <li><b>Миокард (myocardium):</b> мышечный слой. На верхушке сердца мышечные волокна образуют завиток (<i>vortex cordis</i>).</li>
            <li><b>Эпикард (epicardium):</b> наружная серозная оболочка (висцеральный листок перикарда).</li>
          </ul>
          <p><b>Клапанный аппарат</b> фиксируется к фиброзным кольцам (скелету сердца) и включает:</p>
          <ul>
            <li><b>Атриовентрикулярные клапаны:</b> правый трехстворчатый (трикуспидальный) и левый двухстворчатый (митральный). Предотвращают обратный ток крови в предсердия во время систолы.</li>
            <li><b>Полулунные клапаны:</b> клапан аорты и клапан легочного ствола (каждый имеет по три заслонки). Предотвращают обратный ток крови в желудочки во время диастолы.</li>
          </ul>

          <h4>4. Проводящая система сердца и иннервация</h4>
          <p>Обеспечивает автоматизм сокращений за счет атипичных кардиомиоцитов:</p>
          <ol>
            <li><b>Синусно-предсердный узел (узел Кейт-Флака):</b> водитель ритма I порядка. Расположен в стенке правого предсердия между устьями полых вен.</li>
            <li><b>Предсердно-желудочковый узел (узел Ашоффа-Тавара):</b> водитель ритма II порядка. Расположен в нижней части межпредсердной перегородки.</li>
            <li><b>Пучок Гиса и волокна Пуркинье:</b> передают электрические импульсы рабочему миокарду желудочков.</li>
          </ol>
          <p><b>Иннервация:</b> блуждающий нерв (<i>n. vagus</i>, Х пара ЧМН) оказывает тормозящее действие (вызывает брадикардию), а симпатические нервы оказывают стимулирующее действие (вызывают тахикардию).</p>

          <h4>5. Коронарное кровоснабжение</h4>
          <p>Осуществляется правой (RCA) и левой (LCA) коронарными артериями, отходящими от луковицы аорты сразу над заслонками аортального клапана:</p>
          <ul>
            <li><b>Правая коронарная артерия:</b> кровоснабжает правое предсердие, правый желудочек, заднюю треть межжелудочковой перегородки и проводящие узлы. Отдает заднюю межжелудочковую ветвь.</li>
            <li><b>Левая коронарная артерия:</b> делится на переднюю межжелудочковую ветвь (LAD) и огибающую ветвь (CX). Кровоснабжает левые отделы сердца и передние 2/3 межжелудочковой перегородки.</li>
          </ul>

          <h4>6. Особенности кровообращения плода (Фетоплацентарное кровообращение)</h4>
          <p>Поскольку легкие плода спавшиеся и не участвуют в газообмене, а печень выполняет преимущественно кроветворную функцию, гемодинамика плода имеет уникальные шунты:</p>
          <ol>
            <li><b>Пупочная вена (v. umbilicalis):</b> несет чистую артериальную кровь от плаценты к телу плода.</li>
            <li><b>Аранциев проток (ductus venosus):</b> соединяет пупочную вену с нижней полой веной, сбрасывая большую часть артериальной крови в системный кровоток в обход нефункционирующей печени.</li>
            <li><b>Овальное окно (foramen ovale):</b> соустье в межпредсердной перегородке, сбрасывающее кровь из правого предсердия сразу в левое (в обход малого круга кровообращения).</li>
            <li><b>Боталлов проток (ductus arteriosus):</b> соединяет легочный ствол с дугой аорты, перенаправляя кровь из правого желудочка в большой круг в обход спавшихся легких.</li>
          </ol>
          <p>Сразу после рождения и первого вдоха легкие расправляются, давление в легочном стволе падает, и шунты закрываются, превращаясь в связки (круглая связка печени, венозная связка, артериальная связка) и закрытое овальное окно (fossa ovalis).</p>
        `
      },
      {
        title: "Глава 3: Анатомия дыхательной системы",
        content: `
          <p>Дыхательная система (<i>systema respiratorium</i>) состоит из воздухоносных путей и дыхательных отделов легких. Воздухоносные пути делят на верхние (носовая полость, носоглотка, ротоглотка) и нижние (гортань, трахея, бронхи).</p>
          <p><b>Трахея (trachea):</b> трубка длиной 9-11 см, состоящая из 16-20 гиалиновых хрящевых полуколец, соединенных кольцевыми связками. Сзади полукольца замыкаются перепончатой стенкой, прилегающей к пищеводу.</p>
          <p><b>Легкие (pulmones):</b> правое легкое имеет 3 доли (верхнюю, среднюю, нижнюю), разделенные косой и горизонтальной щелями. Левое легкое имеет 2 доли (верхнюю и нижнюю), разделенные косой щелью. На внутренней поверхности легких находятся ворота (<i>hilum pulmonis</i>), куда входят главный бронх, легочная артерия и нервы, а выходят легочные вены и лимфатические сосуды.</p>
        `
      },
      {
        title: "Глава 4: Анатомия пищеварительной системы и печени",
        content: `
          <p>Пищеварительная система состоит из пищеварительного тракта и крупных пищеварительных желез (печень, поджелудочная железа).</p>
          <p><b>Желудок (gaster):</b> мешкообразное расширение ЖКТ, расположенное в левой подреберной и собственно надчревной областях. Выделяют кардиальную часть, дно (свод), тело и пилорическую (привратниковую) часть.</p>
          <p><b>Печень (hepar):</b> самая крупная железа тела человека (около 1.5 кг), расположенная в правом подреберье. Имеет диафрагмальную и висцеральную поверхности. Структурно-функциональной единицей является печеночная долька (<i>lobulus hepatis</i>), образованная гепатоцитами, печеночными балками и синусоидными капиллярами.</p>
        `
      }
    ]
  },
  grays_anatomy: {
    id: "grays_anatomy",
    subjectId: "anatomy",
    title: "Gray's Anatomy",
    author: "Susan Standring",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Anatomical Nomenclature and Body Axes",
        content: `
          <p><b>Anatomical science</b> describes the structure, position, and relationships of parts of the human body. To establish clear medical terminology, descriptions are based on the standard <b>anatomical position</b>: the body is erect, facing forward, with arms at the sides and palms facing forward.</p>
          <p>The body is divided by three principal planes:</p>
          <ul>
            <li><b>Sagittal plane:</b> a vertical plane passing from anterior to posterior, dividing the body into right and left portions.</li>
            <li><b>Coronal (frontal) plane:</b> a vertical plane dividing the body into anterior (front) and posterior (back) parts.</li>
            <li><b>Transverse (axial) plane:</b> a horizontal plane dividing the body into superior (upper) and inferior (lower) parts.</li>
          </ul>
          <p>Key directional terms include: <i>superior</i> (towards the head), <i>inferior</i> (towards the feet), <i>anterior/ventral</i> (front), and <i>posterior/dorsal</i> (back).</p>
        `
      },
      {
        title: "Chapter 2: Anatomy of the Cardiovascular System",
        content: `
          <p>The <b>heart</b> is a fibromuscular pump situated in the middle mediastinum, enclosed within the pericardium. It consists of four chambers: the right and left atria, and the right and left ventricles.</p>
          <p><b>Right chambers:</b> The right atrium receives deoxygenated blood from the superior and inferior venae cavae. Blood flows into the right ventricle through the <b>tricuspid valve</b>. During systole, the right ventricle ejects blood into the pulmonary trunk past the pulmonary valve.</p>
          <p><b>Left chambers:</b> The left atrium receives oxygenated blood from the four pulmonary veins. It opens into the left ventricle via the <b>mitral (bicuspid) valve</b>. The left ventricle, which possesses a muscular wall approximately three times thicker than the right, pumps blood into the systemic aorta through the aortic valve.</p>
        `
      },
      {
        title: "Chapter 3: Anatomy of the Respiratory Tract",
        content: `
          <p>The respiratory system is subdivided into the upper respiratory tract (nasal cavity, pharynx) and the lower respiratory tract (larynx, trachea, bronchi, and lungs).</p>
          <p>The <b>trachea</b> is a cartilaginous tube, 10-12 cm long, kept patent by 16-20 C-shaped rings of hyaline cartilage. The posterior gap is closed by the fibroelastic trachealis muscle, adjacent to the esophagus.</p>
          <p>The <b>lungs</b> are situated in the pleural cavities. The right lung is divided into three lobes (superior, middle, and inferior) by oblique and horizontal fissures. The left lung has two lobes (superior and inferior) and features a cardiac notch on its anterior border to accommodate the apex of the heart.</p>
        `
      },
      {
        title: "Chapter 4: Anatomy of the Liver and Gastrointestinal Tract",
        content: `
          <p>The gastrointestinal tract consists of the oral cavity, esophagus, stomach, small intestine, large intestine, and accessory organs including the salivary glands, liver, gallbladder, and pancreas.</p>
          <p>The <b>liver</b> is the largest internal organ, weighing 1.2–1.6 kg, situated in the right upper quadrant. It is divided into right, left, caudate, and quadrate lobes. Its microscopic structure centers on the <b>hepatic lobule</b>, a hexagonal cylinder of hepatocytes organized into plates radiating from a central vein, separated by vascular sinusoids containing Kupffer phagocytes.</p>
        `
      }
    ]
  },

  // --- HISTOLOGY BOOKS ---
  afanasiev_histology: {
    id: "afanasiev_histology",
    subjectId: "histology",
    title: "Гистология, цитология и эмбриология",
    author: "Ю.И. Афанасьев",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Клеточная теория и строение мембраны",
        content: `
          <p><b>Клеточная теория</b> — обобщенное представление о строении, функционировании и размножении живых клеток. Клетка является элементарной структурно-функциональной единицей живого.</p>
          <p><b>Плазмолемма (цитомембрана):</b> имеет толщину около 7.5 - 10 нм и построена по принципу жидкостно-мозаичной модели. Она состоит из бислоя липидов (фосфолипиды, холестерин, гликолипиды), в который погружены белки. Липиды имеют гидрофильные «головки» и гидрофобные «хвосты», обращенные внутрь мембраны. Мембранные белки подразделяют на интегральные (пронизывающие мембрану), полуинтегральные и периферические.</p>
        `
      },
      {
        title: "Глава 2: Гистология нервной ткани",
        content: `
          <p>Нервная ткань (<i>textus nervosus</i>) состоит из двух типов клеток: нейронов (нейроцитов) и нейроглии. Нейроны осуществляют прием, обработку и передачу нервных импульсов, а глия обеспечивает их жизнедеятельность.</p>
          <p><b>Нейроны:</b> имеют тело (перикарион), дендриты (ветвящиеся отростки, приносящие импульс) и один аксон (проводящий импульс от тела клетки). В цитоплазме нейронов сильно развит шероховатый ЭПР, который при окраске анилиновыми красителями выявляется в виде **тигроида (вещества Ниссля)**.</p>
          <p><b>Синапсы:</b> специализированные контакты между нейронами. Выделяют пресинаптическую мембрану (содержит везикулы с медиатором), синаптическую щель и постсинаптическую мембрану с рецепторами.</p>
        `
      },
      {
        title: "Глава 3: Гистология почек и фильтрационного барьера",
        content: `
          <p>Паренхима почки делится на корковое и мозговое вещество. Структурно-функциональная единица — нефрон.</p>
          <p><b>Почечное тельце:</b> состоит из сосудистого клубочка (капиллярной сети) и капсулы Боумена-Шумлянского. Фильтрационный барьер образован фенестрированным эндотелием, трехслойной базальной мембраной и подоцитами.</p>
          <p><b>Подоциты:</b> отростчатые эпителиальные клетки капсулы. Их малые ножки (педикулы) оплетают капилляры, формируя фильтрационные щели, перекрытые диафрагмой из белка **нефрина**.</p>
        `
      }
    ]
  },
  junqueira_histology: {
    id: "junqueira_histology",
    subjectId: "histology",
    title: "Junqueira's Basic Histology",
    author: "Anthony L. Mescher",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: The Cell Biology of Plasma Membrane",
        content: `
          <p>The <b>plasma membrane</b> (plasmalemma) is a selectively permeable barrier, 7.5 to 10 nm thick, that regulates the passage of materials into and out of the cell. It conforms to the <b>fluid mosaic model</b>.</p>
          <p>The membrane consists of a lipid bilayer containing amphipathic phospholipids, cholesterol, and glycolipids. Phospholipids have polar hydrophilic heads facing the aqueous environment and hydrophobic fatty acid tails facing inward. Membrane proteins are classified as integral (transmembrane) proteins or peripheral proteins associated with the membrane surfaces.</p>
        `
      },
      {
        title: "Chapter 2: Nerve Tissue and Synaptic Structures",
        content: `
          <p>Nerve tissue consists of two major cell populations: <b>neurons</b>, which receive, process, and transmit impulses, and supporting cells called <b>neuroglia</b> (glial cells).</p>
          <p>Neurons typically feature a cell body (perikaryon or soma), multiple dendrites specialized in receiving signals, and a single axon that propagates electrical potentials away from the cell body. The cytoplasm is rich in rough endoplasmic reticulum, visible as basophilic <b>Nissl substance</b> under light microscopy.</p>
          <p>Synapses are highly specialized junctions where chemical transmission occurs via neurotransmitter release into a 20-30 nm synaptic cleft, binding to receptors on the postsynaptic membrane.</p>
        `
      },
      {
        title: "Chapter 3: Histology of the Kidney and Filtration Barrier",
        content: `
          <p>The kidney parenchyma is histologically organized into cortex and medulla, composed of functional units called **nephrons**.</p>
          <p>The **renal corpuscle** consists of a tuft of capillaries, the glomerulus, surrounded by Bowman's capsule. The filtration barrier is a selective three-layer sieve consisting of fenestrated capillary endothelium, a thick fused glomerular basement membrane (GBM), and the slit diaphragms spanning between the pedicels (foot processes) of specialized epithelial cells called **podocytes**.</p>
        `
      }
    ]
  },

  // --- PHYSIOLOGY BOOKS ---
  sudakov_physiology: {
    id: "sudakov_physiology",
    subjectId: "physiology",
    title: "Нормальная физиология",
    author: "К.В. Судаков",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Физиология возбудимых тканей",
        content: `
          <p>К возбудимым тканям относятся нервная, мышечная и железистая ткани. Они способны отвечать на раздражение генерацией потенциала действия.</p>
          <p><b>Мембранный потенциал покоя (ПП):</b> разность потенциалов между наружной и внутренней сторонами мембраны в покое (составляет -70...-90 мВ). Обусловлен избирательной проницаемостью мембраны для ионов калия (\\(K^+\\)) и работой **Na+/K+-насоса** (выкачивает 3 \\(Na^+\\)\\ в обмен на 2 \\(K^+\\)).</p>
          <p><b>Потенциал действия (ПД):</b> быстрый сдвиг мембранного потенциала при возбуждении. Включает фазы:</p>
          <ol>
            <li><b>Деполяризация:</b> лавинообразный вход \\(Na^+\\)\\ через быстрые натриевые каналы.</li>
            <li><b>Реполяризация:</b> закрытие \\(Na^+\\)-каналов и выход \\(K^+\\)\\ из клетки.</li>
          </ol>
        `
      },
      {
        title: "Глава 2: Физиология сердечного выброса",
        content: `
          <p>Работа сердца регулируется внутрисердечными механизмами (закон Старлинга) и вегетативной нервной системой.</p>
          <p><b>Закон Франка-Старлинга:</b> сила сокращения желудочков пропорциональна степени их кровенаполнения в диастолу (степени растяжения мышечных волокон). Чем больше КДО, тем больше ударный объем (УО).</p>
          <p><b>Симпатическая стимуляция:</b> через \\(\\beta_1\\)-адренорецепторы увеличивает ЧСС (положительный хронотропный эффект) и силу сокращений (инотропный эффект) за счет увеличения входа \\(Ca^{2+}\\).</p>
          <p><b>Парасимпатическая стимуляция (n. vagus):</b> через М-холинорецепторы снижает ЧСС и замедляет проводимость в АВ-узле за счет выхода \\(K^+\\) и гиперполяризации клеток.</p>
        `
      },
      {
        title: "Глава 3: Физиологический контроль обмена углеводов",
        content: `
          <p>Уровень глюкозы в плазме поддерживается в узком диапазоне (3.3-5.5 ммоль/л) под действием гормонов островков Лангерганса поджелудочной железы.</p>
          <p><b>Инсулин:</b> единственный гипогликемический гормон. Выделяется бета-клетками, активирует рецепторы с тирозинкиназной активностью, запуская транслокацию транспортеров **GLUT-4** в мембрану скелетных мышц и жировой ткани.</p>
          <p><b>Глюкагон:</b> контринсулярный гормон альфа-клеток. Стимулирует гликогенолиз и глюконеогенез в печени через Gs-белки и цАМФ.</p>
        `
      }
    ]
  },
  guyton_physiology: {
    id: "guyton_physiology",
    subjectId: "physiology",
    title: "Guyton and Hall Textbook of Medical Physiology",
    author: "John E. Hall",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Membrane Potentials and Action Potentials",
        content: `
          <p>Excitable cells (neurons and muscle cells) generate electrical signals across their membranes. The <b>resting membrane potential</b> is approximately -70 to -90 mV, established primarily by K+ diffusion through leak channels and maintained by the active <b>Na+/K+ ATPase pump</b> (pumping 3 Na+ out for every 2 K+ in).</p>
          <p>An <b>action potential</b> is a rapid change in membrane potential that spreads along the cell. It consists of:</p>
          <ul>
            <li><b>Depolarization:</b> activation of voltage-gated Na+ channels, allowing rapid Na+ influx.</li>
            <li><b>Repolarization:</b> closure of Na+ channels and opening of voltage-gated K+ channels, leading to K+ efflux.</li>
          </ul>
        `
      },
      {
        title: "Chapter 2: Regulation of Cardiac Output and Mechanics",
        content: `
          <p>The volume of blood pumped by the heart per minute is regulated by intrinsic mechanics and autonomic nervous control.</p>
          <p><b>Frank-Starling Law of the Heart:</b> Within physiological limits, the force of cardiac contraction is directly proportional to the initial length of the muscle fibers (End-Diastolic Volume, EDV). Greater stretch results in more powerful contraction, increasing Stroke Volume (SV).</p>
          <p><b>Autonomic regulation:</b> Sympathetic stimulation acts via cardiac \\(\\beta_1\\) adrenergic receptors to increase heart rate (chronotropy) and contractility (inotropy) by increasing intracellular Ca2+. Parasympathetic (vagal) stimulation acts via M2 cholinergic receptors to decrease heart rate and AV conduction.</p>
        `
      },
      {
        title: "Chapter 3: Endocrine Control of Blood Glucose",
        content: `
          <p>Plasma glucose concentration is tightly regulated between 70 and 100 mg/dL by the metabolic actions of pancreatic islet hormones.</p>
          <p><b>Insulin:</b> The primary hypoglycemic hormone secreted by beta cells. It binds to membrane receptor tyrosine kinases, promoting the recruitment of **GLUT-4** glucose transporters to the membranes of muscle cells and adipocytes.</p>
          <p><b>Glucagon:</b> Secreted by alpha cells, it acts via Gs-coupled receptors to stimulate glycogenolysis and gluconeogenesis in the liver.</p>
        `
      }
    ]
  },

  // --- BIOCHEMISTRY BOOKS ---
  severin_biochemistry: {
    id: "severin_biochemistry",
    subjectId: "biochemistry",
    title: "Биологическая химия",
    author: "Е.С. Северин",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Энергетический обмен и дыхательная цепь",
        content: `
          <p><b>Тканевое дыхание</b> — процесс окисления субстратов в митохондриях, приводящий к синтезу АТФ. Локализуется на внутренней мембране митохондрий.</p>
          <p><b>Дыхательная цепь (электронтранспортная цепь):</b> состоит из 4 мультибелковых комплексов:</p>
          <ul>
            <li>Комплекс I (NADH-дегидрогеназа)</li>
            <li>Комплекс II (Сукцинатдегидрогеназа)</li>
            <li>Комплекс III (Цитохром-bc1-комплекс)</li>
            <li>Комплекс IV (Цитохромоксидаза)</li>
          </ul>
          <p>Электроны от NADH и FADH2 передаются по цепи к кислороду (образуется \\(H_2O\\)). Перенос электронов сопровождается выкачиванием протонов \\(H^+\\) из матрикса в межмембранное пространство, создавая электрохимический протонный градиент. **АТФ-синтаза (Комплекс V)** использует этот градиент (возврат протонов в матрикс) для фосфорилирования АДФ в АТФ.</p>
        `
      },
      {
        title: "Глава 2: Гликолиз и Цикл Кребса",
        content: `
          <p><b>Гликолиз</b> — анаэробный распад глюкозы до лактата или аэробный до пирувата. Лимитирующими ферментами являются гексокиназа, фосфофруктокиназа (ФФК-1) и пируваткиназа.</p>
          <p><b>Цикл трикарбоновых кислот (ЦТК / цикл Кребса):</b> протекает в матриксе митохондрий. Ацетил-КоА конденсируется с оксалоацетатом с образованием цитрата. За один оборот цикла образуется 3 NADH, 1 FADH2 и 1 ГТФ (путем субстратного фосфорилирования).</p>
        `
      }
    ]
  },
  lippincott_biochemistry: {
    id: "lippincott_biochemistry",
    subjectId: "biochemistry",
    title: "Lippincott Illustrated Reviews: Biochemistry",
    author: "Denise Ferrier",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Oxidative Phosphorylation and Mitochondria",
        content: `
          <p><b>Oxidative phosphorylation</b> is the metabolic pathway in which cells use enzymes to oxidize nutrients, thereby releasing energy which is reformed into ATP. This occurs within the inner mitochondrial membrane.</p>
          <p>The <b>Electron Transport Chain (ETC)</b> comprises four protein complexes (Complexes I-IV). Flow of electrons from NADH and FADH2 to oxygen (the terminal electron acceptor) is coupled to proton translocation from the mitochondrial matrix to the intermembrane space. This creates an electrochemical proton gradient. **ATP Synthase (Complex V)** utilizes the proton-motive force to synthesize ATP from ADP and inorganic phosphate.</p>
        `
      },
      {
        title: "Chapter 2: Glycolysis and Tricarboxylic Acid Cycle",
        content: `
          <p><b>Glycolysis</b> is the pathway converting glucose to pyruvate (under aerobic conditions) or lactate (anaerobic). Key regulatory enzymes include hexokinase, phosphofructokinase-1 (PFK-1), and pyruvate kinase.</p>
          <p>The <b>TCA cycle (Krebs cycle)</b> occurs in the mitochondrial matrix. Acetyl-CoA condenses with oxaloacetate to yield citrate. The cycle acts as a final common pathway for oxidation of fuels, generating 3 NADH, 1 FADH2, and 1 GTP per turn.</p>
        `
      }
    ]
  },

  // --- PATHOPHYSIOLOGY BOOKS ---
  novitsky_pathophysiology: {
    id: "novitsky_pathophysiology",
    subjectId: "pathophysiology",
    title: "Патофизиология",
    author: "В.В. Новицкий",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Патофизиология воспаления",
        content: `
          <p><b>Воспаление (inflammatio)</b> — типовой патологический процесс, выработавшийся в эволюции как защитно-приспособительная реакция на действие повреждающих агентов. Классические местные признаки воспаления:</p>
          <ul>
            <li><i>Rubor</i> (краснота) — артериальная гиперемия.</li>
            <li><i>Tumor</i> (припухлость) — экссудация слизи и отек.</li>
            <li><i>Calor</i> (жар) — усиление обмена веществ.</li>
            <li><i>Dolor</i> (боль) — сдавление нервных окончаний отеком и действие брадикинина.</li>
            <li><i>Functio laesa</i> (нарушение функции).</li>
          </ul>
          <p><b>Медиаторы воспаления:</b> гистамин (расширение сосудов), простагландины (вазодилатация и болевая чувствительность), цитокины ИЛ-1 и ФНО-альфа (активация адгезии лейкоцитов).</p>
        `
      },
      {
        title: "Глава 2: Патофизиология ишемии и атеросклероза",
        content: `
          <p><b>Ишемия</b> — местное малокровие, обусловленное затруднением или прекращением притока артериальной крови к органу или ткани.</p>
          <p><b>Патогенез атеросклероза:</b> повреждение эндотелия → инфильтрация интимы ЛПНП → окисление ЛПНП → поглощение их макрофагами с образованием **пенистых клеток (foam cells)** → формирование фиброзной бляшки, сужающей просвет сосуда.</p>
        `
      }
    ]
  },
  mcphee_pathophysiology: {
    id: "mcphee_pathophysiology",
    subjectId: "pathophysiology",
    title: "Pathophysiology of Disease",
    author: "Gary D. Hammer, Stephen J. McPhee",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Pathophysiology of Inflammation",
        content: `
          <p><b>Inflammation</b> is a localized protective response elicited by injury or destruction of tissues, which serves to destroy, dilute, or wall off both the injurious agent and the injured tissue. The cardinal signs of acute local inflammation are:</p>
          <ul>
            <li><i>Rubor</i> (redness) — caused by vasodilation.</li>
            <li><i>Calor</i> (heat) — due to increased blood flow.</li>
            <li><i>Tumor</i> (swelling) — resulting from increased vascular permeability and exudation.</li>
            <li><i>Dolor</i> (pain) — caused by chemical mediators (like bradykinin) and tissue distension.</li>
            <li><i>Functio laesa</i> (loss of function).</li>
          </ul>
          <p>Key inflammatory mediators include: histamine, prostaglandins (potentiating edema and pain), and cytokines (IL-1, TNF-alpha) mediating systemic acute-phase reactions.</p>
        `
      },
      {
        title: "Chapter 2: Pathophysiology of Atherosclerosis and Ischemia",
        content: `
          <p><b>Ischemia</b> refers to tissue perfusion insufficient to meet metabolic demand, mostly due to arterial constriction or vascular obstruction.</p>
          <p><b>Atherogenesis</b> represents a chronic inflammatory response of the arterial wall to endothelial injury. Low-density lipoproteins (LDLs) accumulate in the intima, undergo oxidation, and trigger monocyte recruitment. Phagocytosis of oxidized LDLs by macrophages yields lipid-laden **foam cells**, culminating in fibrous plaque development.</p>
        `
      }
    ]
  },

  // --- PATHOLOGY (PATHANAT) BOOKS ---
  strukov_pathology: {
    id: "strukov_pathology",
    subjectId: "pathology",
    title: "Патологическая анатомия",
    author: "А.И. Струков, В.В. Серов",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Некроз и апоптоз клеток",
        content: `
          <p>Смерть клеток в живом организме протекает в виде некроза или апоптоза:</p>
          <ul>
            <li><b>Некроз:</b> насильственная гибель клеток под действием сильных повреждающих факторов. Характеризуется набуханием клетки, разрывом мембран и выходом лизосомальных ферментов в окружающие ткани, что вызывает выраженную воспалительную реакцию. Морфологические признаки некроза включают: <i>кариопикноз</i> (сморщивание ядра), <i>кариорексис</i> (распад ядра на глыбки) и <i>кариолизис</i> (растворение ядра).</li>
            <li><b>Апоптоз:</b> генетически запрограммированная гибель отдельных клеток. Идет без разрыва мембран (клетка распадается на апоптотические тельца, поглощаемые макрофагами) и не сопровождается воспалением. Запускается каспазными ферментами.</li>
          </ul>
        `
      },
      {
        title: "Глава 2: Патология дистрофий и амилоидоза",
        content: `
          <p><b>Дистрофия</b> — патологический процесс, характеризующийся нарушением тканевого обмена веществ, ведущий к структурным изменениям клеток и стромы.</p>
          <p><b>Амилоидоз:</b> мезенхимальный диспротеиноз, при котором в межуточной ткани органов откладывается аномальный фибриллярный белок — амилоид. При окраске Конго рот амилоид имеет характерное зеленое свечение в поляризованном свете.</p>
        `
      }
    ]
  },
  robbins_pathology: {
    id: "robbins_pathology",
    subjectId: "pathology",
    title: "Robbins & Cotran Pathologic Basis of Disease",
    author: "Vinay Kumar, Abul K. Abbas, Jon C. Aster",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Cell Injury, Necrosis, and Apoptosis",
        content: `
          <p>Cellular death occurs via two major pathways, necrosis and apoptosis, which differ in their mechanisms, morphology, and clinical implications.</p>
          <ul>
            <li><b>Necrosis:</b> an accidental and unregulated form of cell death resulting from severe damage. It is morphologically characterized by cell swelling (oncosis), protein denaturation, and breakdown of organelles. The leaking of cellular contents triggers a localized inflammatory response. Nuclear changes include <i>karyopyknosis</i> (nuclear shrinkage), <i>karyorrhexis</i> (fragmentation), and <i>karyolysis</i> (dissolution).</li>
            <li><b>Apoptosis:</b> active, enzyme-mediated cell death characterized by nuclear condensation, cellular shrinkage, and fragmentation into membrane-bound apoptotic bodies without eliciting inflammation. It is orchestrated by the activation of <b>caspases</b>.</li>
          </ul>
        `
      },
      {
        title: "Chapter 2: Pathology of Amyloidosis and Intracellular Accumulations",
        content: `
          <p>Intracellular accumulations represent metabolic derangements leading to deposition of abnormal substances (lipids, glycogen, proteins) within cells.</p>
          <p><b>Amyloidosis:</b> a group of disorders characterized by extracellular deposition of misfolded fibrillar proteins (amyloid) that aggregate into beta-pleated sheets. When stained with **Congo Red**, amyloid displays a characteristic apple-green birefringence under polarized light.</p>
        `
      }
    ]
  },

  // --- PHARMACOLOGY BOOKS ---
  kharkevich_pharmacology: {
    id: "kharkevich_pharmacology",
    subjectId: "pharmacology",
    title: "Фармакология",
    author: "Д.А. Харкевич",
    lang: "ru",
    chapters: [
      {
        title: "Глава 1: Общая рецепторная фармакодинамика",
        content: `
          <p><b>Фармакодинамика</b> изучает локализацию, механизм действия и конечные фармакологические эффекты лекарственных средств. Большинство лекарств реализует эффекты через взаимодействие с рецепторами.</p>
          <p>Типы рецепторов по механизму передачи сигнала:</p>
          <ol>
            <li><b>Ионотропные рецепторы:</b> каналы, открывающиеся при связи с лигандом (например, н-холинорецепторы, ГАМК-А рецепторы). Ответ за миллисекунды.</li>
            <li><b>Метаботропные рецепторы (сопряженные с G-белками):</b> активируют внутриклеточные вторичные посредники (цАМФ, \\(IP_3\\), \\(Ca^{2+}\\)) через G-белки (например, м-холинорецепторы, адренорецепторы). Ответ за секунды.</li>
            <li><b>Каталитические (ферментативные):</b> сопряжены с тирозинкиназой (рецепторы инсулина).</li>
            <li><b>Цитозольные (внутриклеточные):</b> рецепторы стероидных гормонов, регулируют транскрипцию ДНК.</li>
          </ol>
        `
      },
      {
        title: "Глава 2: Фармакология диуретиков",
        content: `
          <p>Диуретики (мочегонные средства) угнетают реабсорбцию натрия и воды в различных сегментах нефрона.</p>
          <p><b>Петлевые диуретики (фуросемид, торасемид):</b> самые мощные. Блокируют **Na+/K+/2Cl- котранспортер (NKCC2)** в толстом восходящем колене петли Генле. Приводят к выраженной потере натрия, калия и кальция.</p>
          <p><b>Тиазидные диуретики (гидрохлортиазид, индапамид):</b> блокируют **Na+/Cl- сотранспортер (NCC)** в дистальных извитых канальцах. Обладают умеренным эффектом.</p>
          <p><b>Калийсберегающие (спиронолактон):</b> антагонист альдостерона в собирательных трубках.</p>
        `
      }
    ]
  },
  rang_dale_pharmacology: {
    id: "rang_dale_pharmacology",
    subjectId: "pharmacology",
    title: "Rang & Dale's Pharmacology",
    author: "James M. Ritter et al.",
    lang: "en",
    chapters: [
      {
        title: "Chapter 1: Drug-Receptor Interactions and Pharmacology",
        content: `
          <p><b>Pharmacodynamics</b> is the study of the biochemical and physiological effects of drugs and their mechanisms of action. Most drugs exert effects by binding to specific regulatory proteins called receptors.</p>
          <p>Four main families of receptors are distinguished:</p>
          <ol>
            <li><b>Ligand-gated ion channels (ionotropic receptors):</b> directly coupled to membrane ion channels (e.g., nicotinic ACh receptors, GABA-A receptors). Transmission occurs in milliseconds.</li>
            <li><b>G-protein-coupled receptors (GPCRs, metabotropic):</b> act through intracellular second messengers (cAMP, IP3/DAG, Ca2+) activated by G-protein complexes (e.g., muscarinic ACh receptors, adrenergic receptors). Transmission occurs in seconds.</li>
            <li><b>Kinase-linked and related receptors:</b> transmembrane receptors incorporating intracellular enzymatic domains (e.g., insulin receptors).</li>
            <li><b>Nuclear receptors:</b> intracellular proteins regulating gene transcription (e.g., steroid hormone receptors).</li>
          </ol>
        `
      },
      {
        title: "Chapter 2: Diuretics and Renal Pharmacology",
        content: `
          <p>Diuretics increase urine volume by inhibiting sodium reabsorption at different segments of the nephron.</p>
          <p><b>Loop Diuretics (furosemide, bumetanide):</b> inhibit the luminal **Na+/K+/2Cl- cotransporter (NKCC2)** in the thick ascending limb of the loop of Henle, causing profound saluresis and loss of potassium, calcium, and magnesium.</p>
          <p><b>Thiazides (hydrochlorothiazide):</b> inhibit the active **Na+/Cl- cotransporter (NCC)** in the distal convoluted tubule. They exhibit moderate potency.</p>
          <p><b>Potassium-sparing (spironolactone):</b> acts as a competitive antagonist of aldosterone receptors in the collecting tubule.</p>
        `
      }
    ]
  }
};
