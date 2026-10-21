// All projects live here. To add a new one, append an object to the list.
// category: "Game" | "App" | "AI & Simulation" | "Computer Vision" | "IoT / Hardware" (new categories appear in the filters automatically)
// featured: true -> shown on the home page (first 6)
// images: paths under assets/projects/. With no images, a generated cover using `icon` is shown.
// team: true -> "Team project", false -> "Solo project" (shown in the popup)
// noRepo: true -> no public GitHub repository, so no GitHub button
// highlights / role are optional and only shown in the detail popup.
const PROJECTS = [
    {
        slug: "aftershock-isle",
        team: true,
        title: "Aftershock: Isle",
        icon: "🏚️",
        images: ["aftershock-isle-1.jpg", "aftershock-isle-2.jpg", "aftershock-isle-3.jpg", "aftershock-isle-4.jpg", "aftershock-isle-5.jpg", "aftershock-isle-6.jpg"],
        summary: "A 2.5D survival base-builder: keep a cracked building standing after an earthquake until the evacuation helicopter arrives.",
        description: "Aftershock: Isle is a side-view crisis management and survival game set in a city hit by an earthquake, made with PBH Studio for a game jam in October 2026. Survivors shelter in a four-storey building seen in cross-section. Each day has three phases: in the morning they dig rubble, brace columns and craft at the workbench; at midday one of them heads out to scavenge the city; at night the shelter faces aftershocks, flooding, fires and raids. To win, you upgrade the workbench, repair the rooftop radio and hold the evacuation signal before the building's structural integrity runs out.",
        highlights: [
            "Structural integrity system: aftershocks, water and fire wear the building down, braced columns hold it up",
            "Disaster director that schedules aftershocks, floods, fires, gas leaks and night raids",
            "Active pause, survivor tasks, evening plan and a 3-branch skill tree",
            "City-map expeditions with a weight-based backpack, cover-based combat and six locations",
            "Event-bus architecture, A* pathfinding and JSON save system (~150 C# scripts)",
            "Outdoor scenery generated procedurally with Blender Python scripts"
        ],
        category: "Game",
        tags: ["C#", "Unity", "URP", "Blender", "Game Jam"],
        featured: true,
        year: 2026
    },
    {
        slug: "stratis",
        team: true,
        title: "STRATIS",
        icon: "🎓",
        summary: "A tactical AI simulation in Unity that combines reinforcement learning with rule-based decisions.",
        description: "STRATIS is my first graduation project. It is a tactical combat simulation built in Unity, where agents are trained with ML-Agents using PPO. Reinforcement learning is combined with rule-based decision logic to drive the agents' real-time combat behavior.",
        highlights: [
            "Agents trained with Unity ML-Agents (PPO)",
            "Reinforcement learning combined with rule-based decision logic",
            "Real-time combat behavior in a tactical simulation"
        ],
        category: "AI & Simulation",
        tags: ["C#", "Unity", "ML-Agents", "Reinforcement Learning", "Graduation Project"],
        featured: true,
        year: 2025
    },
    {
        slug: "tusas-lift-up",
        noRepo: true,
        team: true,
        title: "TUSAŞ Lift Up",
        icon: "✈️",
        summary: "A Digital Image Correlation application that tracks fatigue cracks through strain and displacement fields.",
        description: "My second graduation project, carried out in the TUSAŞ Lift Up program. It is a Digital Image Correlation (DIC) based application that analyzes strain concentration and how the displacement field changes over time, and uses them as indicators of fatigue cracks. Its results were checked against data from real fatigue tests.",
        highlights: [
            "Strain concentration and displacement-field analysis with DIC",
            "Fatigue crack indicators from how the fields change over time",
            "Accuracy validated against experimental fatigue test data"
        ],
        category: "Computer Vision",
        tags: ["Digital Image Correlation", "Graduation Project"],
        featured: true,
        year: 2026
    },
    {
        slug: "teknofest-air-defense",
        noRepo: true,
        team: true,
        title: "Teknofest Air Defense System",
        icon: "🎯",
        summary: "A real-time embedded vision system that detects shapes and colors from up to 10 meters away.",
        description: "An air defense system built for Teknofest. The vision software runs in real time on embedded hardware and detects target shapes and colors from up to 10 meters away. The detection algorithms were written from scratch and tuned to run on the embedded board.",
        role: "Led the software team, wrote the detection algorithms and optimized them for the embedded hardware.",
        highlights: [
            "Real-time shape and color detection up to 10 m",
            "Detection algorithms written from scratch",
            "Optimized to run on embedded hardware"
        ],
        category: "Computer Vision",
        tags: ["Embedded", "Real-Time", "Teknofest"],
        featured: true,
        year: 2025
    },
    {
        slug: "smart-solar-panel",
        noRepo: true,
        team: true,
        title: "Smart Solar Panel",
        icon: "☀️",
        summary: "A TÜBİTAK-funded IoT solar panel that turns itself in real time using weather data.",
        description: "A research project funded under TÜBİTAK's 2209-A University Students Research Projects programme. The panel reads real-time weather data and uses an adaptive positioning algorithm to change its orientation, so it collects as much energy as possible.",
        role: "Researcher and developer.",
        highlights: [
            "Real-time weather data ingestion",
            "Adaptive positioning algorithm for panel orientation",
            "Sensor and embedded control integration",
            "Funded by TÜBİTAK 2209-A"
        ],
        category: "IoT / Hardware",
        tags: ["Python", "IoT", "Sensors", "Embedded", "TÜBİTAK 2209-A"]
    },
    {
        slug: "mask-heist",
        team: true,
        title: "Mask Heist",
        icon: "🎭",
        summary: "An online multiplayer heist-and-seek game made for Global Game Jam 2026.",
        description: "Mask Heist is a round-based multiplayer game built for Global Game Jam 2026. Each round one player becomes the Hider and has 30–45 seconds to stash a randomly chosen loot item somewhere on the map, while everyone else plays as masked Seekers who have to find and steal it. Every player gets a turn as the Hider, and the highest total score wins.",
        highlights: [
            "Online lobby with room creation and joining, built on Mirror networking",
            "Round flow with phases: loot assignment, hiding, seeker briefing, search and scoreboard",
            "Hider traps such as proximity mines and laser tripwires",
            "Shared mask ability for Seekers: 10 seconds of invisibility to snatch the loot",
            "Anti-camping rules that penalize a Hider who waits next to the hidden item"
        ],
        role: "Implemented network-based character synchronization and real-time data management within the 48-hour jam.",
        category: "Game",
        tags: ["C#", "Unity", "Mirror", "Multiplayer", "Game Jam"],
        featured: true,
        year: 2026
    },
    {
        slug: "fiasco-circus",
        team: true,
        title: "Fiasco Circus",
        icon: "🎪",
        images: ["fiasco-circus-1.jpg", "fiasco-circus-2.gif", "fiasco-circus-4.gif", "fiasco-circus-3.jpg"],
        summary: "A dark, whimsical pixel-art circus game from Global Game Jam 2025.",
        description: "Fiasco Circus was developed during Global Game Jam 2025 at İzmir University of Economics. The jam theme was \"Make Me Laugh\", and the team gave it a darker twist: a circus where things go hilariously wrong. The game has a menu, several circus scenes including a lion stage and a tightrope scene, enemy clowns that shoot back, and a game-over screen.",
        role: "Created all the character art and animations in Aseprite, implemented core gameplay in Unity and helped with project management.",
        highlights: [
            "Hand-drawn pixel-art characters and animations made in Aseprite",
            "Player movement, air control and melee attacks",
            "Shooting enemies, health and damage systems",
            "Multiple scenes with an audio manager and main menu"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Aseprite", "Pixel Art", "Game Jam"],
        year: 2025
    },
    {
        slug: "galaxy-defender",
        team: true,
        title: "Bubble Galaxy Defender",
        icon: "🛸",
        images: ["galaxy-defender-3.jpg", "galaxy-defender-1.jpg", "galaxy-defender-2.jpg", "galaxy-defender-4.jpg"],
        summary: "A space tower defense game where you protect a shielded base from alien waves.",
        description: "In Bubble Galaxy Defender, you play an astronaut defending a spaceship base protected by a bubble shield. Enemy creatures spawn in waves and head for the base. You fight them directly with your pistol, pick up ammo packs and scrap, and rely on towers that automatically lock onto the nearest enemy.",
        role: "Designed the game mechanics and gameplay logic, drew the pixel-art sprites and handled asset integration in a three-person team.",
        highlights: [
            "Top-down player movement with directional idle, run and dash animations",
            "Limited ammo with pickups and a scrap resource",
            "Auto-targeting towers and enemy health bars",
            "Enemy spawner, base shield and game-over flow"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Pixel Art", "Tower Defense"],
        year: 2025
    },
    {
        slug: "tania-diagnosis-assistant",
        team: true,
        title: "TanIA",
        icon: "🩺",
        images: ["tania-diagnosis-assistant-1.jpg"],
        summary: "An NLP-based decision support system that routes hospital patients to the right specialist.",
        description: "TanIA is a decision support system that uses natural language processing to improve the patient experience and hospital workflow. Patients describe their complaints by typing or speaking, and the system directs them to the most suitable medical department. It also gives doctors a preliminary report of possible conditions based on the symptoms.",
        role: "Worked on symptom analysis, preliminary assessments and routing patients to the right specialty.",
        highlights: [
            "Desktop GUI where patients sign in with their national ID number",
            "Offline Turkish speech-to-text with a Vosk model",
            "Symptom analysis over a curated symptom and category dataset",
            "Specialist recommendation and preliminary diagnosis reports for doctors"
        ],
        category: "AI & Simulation",
        tags: ["Python", "NLP", "Speech Recognition", "Vosk"],
        featured: true,
        year: 2024
    },
    {
        slug: "online-pet-adopting-app",
        team: true,
        title: "Online Pet Adopting App",
        icon: "🐾",
        summary: "A Flutter mobile app that connects people with shelter pets waiting for adoption.",
        description: "A software engineering group project: a mobile app that brings adopters, animal shelters and administrators together. Adopters browse pets and apply to adopt them, shelters publish listings and review applications, and admins oversee the whole platform.",
        highlights: [
            "Onboarding, sign-up and login flows",
            "Pet listings with detail pages and an adoption application form",
            "\"My applications\" tracking and in-app notifications",
            "Shelter dashboard for creating pets and reviewing applications",
            "Admin dashboard, Provider state management and unit-tested services"
        ],
        category: "App",
        tags: ["Dart", "Flutter", "Provider", "Mobile"],
        featured: true,
        year: 2026
    },
    {
        slug: "infinite-rusher",
        team: false,
        title: "Infinite Rusher",
        icon: "🏃",
        images: ["infinite-rusher-1.jpg", "infinite-rusher-2.jpg", "infinite-rusher-3.jpg"],
        summary: "A Subway Surfers-style endless runner built to practice object pooling.",
        description: "Infinite Rusher is an endless runner inspired by Subway Surfers. It was built to learn and practice core game mechanics and object pooling, so it focuses on how the game works rather than on visuals. The path keeps generating as you run, and it gets harder the further you go.",
        highlights: [
            "Endlessly generated ground with object pooling for performance",
            "Randomly spawned obstacles and collectibles",
            "Coin collection and a persistent high score",
            "Cooldown mechanics and a health system"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Object Pooling"],
        year: 2025
    },
    {
        slug: "uniclub",
        team: true,
        title: "UniClub",
        icon: "📅",
        images: ["uniclub-2.jpg", "uniclub-1.jpg", "uniclub-3.jpg", "uniclub-4.jpg"],
        summary: "A Flutter app that keeps students up to date with university club events.",
        description: "UniClub highlights and organizes events hosted by university student communities, so students never miss a chance to take part. Important events appear at the top of the home page, and every community has its own page with its mission, past events and upcoming activities.",
        highlights: [
            "Highlighted events on the home page",
            "Interactive calendar view",
            "Community detail pages and search",
            "Firebase-backed sign-up, login and real-time updates",
            "Reminders for saved and favorite events"
        ],
        category: "App",
        tags: ["Dart", "Flutter", "Firebase", "Mobile"],
        year: 2025
    },
    {
        slug: "post-disaster-resource-allocation-simulation",
        team: false,
        title: "Post-Disaster Resource Allocation",
        icon: "🚑",
        summary: "An agent-based simulation of how aid reaches survivors after a disaster.",
        description: "An agent-based model built with Repast Simphony that simulates the distribution of relief resources after a disaster. Survivor agents move across a grid and become more anxious every step they go without help, while resource centers hand out aid that lowers the anxiety of the survivors nearby.",
        highlights: [
            "Survivor and resource center agents on a grid space",
            "Scheduled step-based behavior with random movement",
            "Anxiety metric to measure how well aid is being distributed",
            "Custom context builder and scheduler"
        ],
        category: "AI & Simulation",
        tags: ["Java", "Repast Simphony", "Agent-Based Modeling"],
        year: 2025
    },
    {
        slug: "tappy-fish",
        team: false,
        title: "Tappy Fish",
        icon: "🐟",
        images: ["tappy-fish-1.jpg", "tappy-fish-2.jpg", "tappy-fish-3.jpg", "tappy-fish-4.jpg"],
        summary: "One of my first games: a tap-to-swim arcade game about dodging obstacles.",
        description: "Tappy Fish is one of my first game development projects, made to learn the basics of game mechanics. You tap to make the fish swim upward and dodge obstacles. It's simple to pick up, but it gets tougher the longer you survive.",
        highlights: [
            "One-tap controls",
            "Obstacle spawner with increasing difficulty",
            "Score, high score and medal system"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Mobile"],
        year: 2023
    },
    {
        slug: "earthquake-game",
        team: true,
        title: "Earthquake Game",
        icon: "🏫",
        summary: "An early prototype of an earthquake-themed game set in a 3D classroom.",
        description: "An early-stage prototype of an earthquake-themed game. The repository contains the 3D classroom environment (desks, chairs, boards, doors and lamps), materials and the character setup that the game was being built on.",
        category: "Game",
        tags: ["Unity", "3D", "Prototype"],
        year: 2024
    },
    {
        slug: "snowbound-story-game",
        team: true,
        title: "Snowbound",
        icon: "❄️",
        images: ["snowbound-story-game-1.png"],
        pixelated: true,
        summary: "A 2D action-defense game made for the PYNG game jam.",
        description: "Snowbound was made by a team for the PYNG game jam. You defend your base against waves of enemies with a mouse-aimed gun and pick up items along the way, while towers automatically shoot the closest enemy within range.",
        highlights: [
            "Crosshair aiming and player combat",
            "Enemy spawner and base health system",
            "Auto-targeting towers with range and fire rate",
            "Item pickups and camera follow"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Pixel Art", "Game Jam"],
        year: 2023
    },
    {
        slug: "invaders-from-space",
        team: false,
        title: "Invaders from Space",
        icon: "👾",
        images: ["invaders-from-space-1.png"],
        pixelated: true,
        summary: "A remake of the classic Space Invaders arcade game.",
        description: "A remake of the arcade classic Space Invaders. Rows of aliens march down the screen and fire back, while a mothership occasionally flies past for bonus points. You defend yourself from behind destructible shields.",
        highlights: [
            "Alien formation controlled by a master controller",
            "Bonus mothership",
            "Destructible shields",
            "Object pooling for bullets, plus ship stats and health"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Arcade"],
        year: 2023
    },
    {
        slug: "3d-runner",
        team: false,
        title: "3D Runner",
        icon: "🏁",
        summary: "A 3D race to the finish line against AI opponents.",
        description: "A 3D runner where you race AI opponents to the finish line. The opponents use Unity's NavMesh to find their way around animated obstacles, and speed boosters can swing the race.",
        highlights: [
            "NavMesh-driven AI opponents",
            "Animated obstacles and collision checks",
            "Speed boosters and a finish line",
            "Follow camera and click-to-move test scene"
        ],
        category: "Game",
        tags: ["C#", "Unity", "3D", "NavMesh"],
        year: 2023
    },
    {
        slug: "pong",
        team: false,
        title: "Pong",
        icon: "🏓",
        summary: "The classic Pong, remade in Unity with an AI opponent.",
        description: "A Unity remake of the classic Pong. You control one paddle and an AI controls the other. The ball bounces off the paddles and walls, and a game manager keeps score.",
        highlights: [
            "Player paddle controls",
            "AI opponent that follows the ball",
            "Ball bounce physics and scoring"
        ],
        category: "Game",
        tags: ["C#", "Unity", "Arcade"],
        year: 2023
    },
    {
        slug: "shopping-application",
        team: true,
        title: "Shopping Application",
        icon: "🛒",
        summary: "A Java Swing shopping app built for an object-oriented programming course.",
        description: "A desktop shopping application written in Java with a Swing interface for an object-oriented programming course. Users can browse products, keep favorites, manage their credit cards and place orders.",
        highlights: [
            "Swing GUI with product, favorites, card and order lists",
            "User, Product, Order and CreditCard classes",
            "Object-oriented design with encapsulated models"
        ],
        category: "App",
        tags: ["Java", "Swing", "OOP"],
        year: 2024
    },
    {
        slug: "library-management-system",
        team: false,
        title: "Library Management System",
        icon: "📚",
        summary: "A simple command-line library system written in Python.",
        description: "A command-line library management system in Python. Books are stored in a text file with their title, author, release year and page count, and you can list, add and remove them from the terminal.",
        highlights: [
            "List, add and remove books",
            "File-based storage with error handling"
        ],
        category: "App",
        tags: ["Python", "CLI"],
        year: 2024
    },
    {
        slug: "e-commerce-app",
        team: false,
        title: "E-Commerce App",
        icon: "🛍️",
        summary: "An object-oriented e-commerce model written in Java.",
        description: "An object-oriented e-commerce project in Java that models users, products, orders and credit cards, and the relationships between them.",
        category: "App",
        tags: ["Java", "OOP"],
        year: 2023
    }
];

const GITHUB_USER = "GoncaArabaci";
