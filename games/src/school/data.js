/* Living School · world data. Everything that makes Hollow Creek High a place:
   who goes there, where they spend their time, what they say, and the events
   that can happen to you. The simulation reads this; changing a row here
   changes the game without touching the rules. */
const SchoolData = (() => {
  const TOPICS = {
    sports: 'sports', music: 'music', games: 'video games', movies: 'movies', art: 'art', science: 'science',
    fashion: 'fashion', food: 'food', books: 'books', skating: 'skating', cars: 'cars'
  };

  // traits are 0..1; humor is the kind of joke that lands; open = how open they are to romance with you
  const CAST = [
    { id: 'marcus', name: 'Marcus Bell', first: 'Marcus', pro: 'he', clique: 'jocks',
      bio: 'Varsity captain. Everybody\'s friend until you cost him a game.',
      look: { skin: '#5c3a1e', hair: '#0f0b08', style: 'fade', shirt: '#1e5b47' },
      traits: { warmth: 0.7, humor: 'goofy', ambition: 0.8, drama: 0.3, confidence: 0.85, loyalty: 0.8, open: 0.35 },
      likes: ['sports', 'music', 'food'], dislikes: ['books', 'art'],
      hoops: { skill: 0.74, spots: ['le', 're', 'top', 'ft'], trash: ['Captain\'s shot.', 'Elbow, baby.', 'You sure about this?'] },
      sched: { morning: { gym: 3, hall: 1 }, lunch: 'jocks', after: { practice: 5, park: 1 }, day: { park: 2, mall: 1, diner: 1 }, night: { party: 2, movies: 1, home: 1 } },
      voice: { love: ['Bro. ', 'Yo! '], dislike: ['Nah. ', 'Come on, man. '] },
      secret: { recall: 'the college thing', text: 'Marcus told you he isn\'t sure he even wants to play in college. His dad already told everyone he\'s going D1.', short: 'Marcus doesn\'t want to play in college' } },
    { id: 'tyler', name: 'Tyler Reyes', first: 'Tyler', pro: 'he', clique: 'jocks',
      bio: 'Shoots first, asks never. Pretty sure you\'re after his spot.',
      look: { skin: '#c68642', hair: '#2b1d14', style: 'swoop', shirt: '#b4342d' },
      traits: { warmth: 0.35, humor: 'dry', ambition: 0.75, drama: 0.55, confidence: 0.95, loyalty: 0.5, open: 0.3 },
      likes: ['sports', 'cars', 'games'], dislikes: ['art', 'science', 'books'],
      hoops: { skill: 0.78, spots: ['top', 'lw', 'rw', 'deep'], trash: ['Range.', 'Too easy.', 'Watch and learn.'] },
      sched: { morning: { gym: 3, hall: 1 }, lunch: 'jocks', after: { practice: 4, park: 2 }, day: { park: 3, mall: 1 }, night: { party: 2, home: 1 } },
      voice: { love: ['Okay, ', 'Ha, '], dislike: ['Lame. ', 'Whatever. '] },
      secret: { recall: 'my chem grade', text: 'Tyler admitted he\'s failing chemistry. If his grades don\'t come up, he\'s ineligible.', short: 'Tyler might be academically ineligible' } },
    { id: 'hannah', name: 'Hannah Cole', first: 'Hannah', pro: 'she', clique: 'jocks',
      bio: 'Girls\' varsity point guard. Best shooter in the building, and she knows it.',
      look: { skin: '#f6d3b3', hair: '#c9772f', style: 'pony', shirt: '#e3b23c' },
      traits: { warmth: 0.65, humor: 'dry', ambition: 0.85, drama: 0.2, confidence: 0.8, loyalty: 0.75, open: 0.55 },
      likes: ['sports', 'music', 'food'], dislikes: ['fashion', 'games'],
      hoops: { skill: 0.86, spots: ['lc', 'rc', 'lw', 'rw'], trash: ['Corner pocket.', 'Your turn.', 'Don\'t think. Shoot.'] },
      sched: { morning: { gym: 3, library: 1 }, lunch: 'jocks', after: { practice: 4, park: 1 }, day: { park: 2, diner: 1 }, night: { home: 2, movies: 1, party: 1 } },
      voice: { love: ['Ha! '], dislike: ['Pass. '] },
      secret: { recall: 'the scholarship', text: 'Hannah has a scholarship offer from a school three time zones away and hasn\'t told anyone, including her mom.', short: 'Hannah has a secret scholarship offer' } },
    { id: 'priya', name: 'Priya Shah', first: 'Priya', pro: 'she', clique: 'brains',
      bio: 'Class president, robotics captain, three APs. Running on cold brew.',
      look: { skin: '#a86b3c', hair: '#0f0b08', style: 'long', shirt: '#2f4f8a', acc: 'glasses' },
      traits: { warmth: 0.55, humor: 'dry', ambition: 0.95, drama: 0.35, confidence: 0.7, loyalty: 0.7, open: 0.5 },
      likes: ['science', 'books', 'music'], dislikes: ['sports', 'games'],
      hoops: { skill: 0.45, spots: ['ft', 'lane'], trash: ['I calculated this.', 'Physics.'] },
      sched: { morning: { library: 4, hall: 1 }, lunch: 'brains', after: { robotics: 4, library: 1 }, day: { library: 2, diner: 1, mall: 1 }, night: { home: 3, movies: 1 } },
      voice: { love: ['Okay, fascinating. '], dislike: ['Respectfully, no. '] },
      secret: { recall: 'the waitlist', text: 'Priya got waitlisted at her dream school. She\'s told everyone she hasn\'t heard back yet.', short: 'Priya got waitlisted' } },
    { id: 'eli', name: 'Eli Novak', first: 'Eli', pro: 'he', clique: 'brains',
      bio: 'Builds robots, beats everyone at Smash. Says about nine words a day.',
      look: { skin: '#f1c27d', hair: '#3b2716', style: 'curly', shirt: '#6b3fa0', acc: 'glasses' },
      traits: { warmth: 0.6, humor: 'goofy', ambition: 0.5, drama: 0.1, confidence: 0.2, loyalty: 0.95, open: 0.45 },
      likes: ['games', 'science', 'movies'], dislikes: ['sports', 'fashion'],
      hoops: { skill: 0.35, spots: ['ft', 'lane'], trash: ['Um.', 'I have never done this.'] },
      sched: { morning: { library: 3, hall: 1 }, lunch: 'brains', after: { robotics: 4, home: 1 }, day: { home: 3, mall: 1 }, night: { home: 4 } },
      voice: { love: ['Oh! ', 'Wait, '], like: ['Um, cool. '], dislike: ['Uh... '] },
      secret: { recall: 'the Hannah thing', text: 'Eli has had a crush on Hannah since eighth grade. He made you promise not to say anything.', short: 'Eli has a crush on Hannah' } },
    { id: 'jordan', name: 'Jordan Kim', first: 'Jordan', pro: 'they', clique: 'theater',
      bio: 'Drama club\'s loudest member. Knows everything about everyone by second period.',
      look: { skin: '#e0ac69', hair: '#7a2e8a', style: 'bob', shirt: '#e2581f' },
      traits: { warmth: 0.8, humor: 'goofy', ambition: 0.6, drama: 0.95, confidence: 0.75, loyalty: 0.55, open: 0.5 },
      likes: ['movies', 'music', 'fashion'], dislikes: ['sports', 'science'],
      hoops: { skill: 0.3, spots: ['ft'], trash: ['This is performance art.'] },
      sched: { morning: { hall: 3, courtyard: 2 }, lunch: 'theater', after: { drama: 4, diner: 1 }, day: { mall: 3, diner: 1 }, night: { party: 3, movies: 1 } },
      voice: { love: ['Oh my GOD. ', 'Stop. '], dislike: ['Darling, no. '] },
      secret: { recall: 'the audition', text: 'Jordan isn\'t auditioning for the lead in the spring musical. They\'re terrified, and they\'re telling everyone it\'s "creative differences."', short: 'Jordan is scared to audition' } },
    { id: 'sofia', name: 'Sofia Marino', first: 'Sofia', pro: 'she', clique: 'theater',
      bio: 'Runs the social calendar. Dating Marcus, at least this week.',
      look: { skin: '#f1c27d', hair: '#2b1d14', style: 'long', shirt: '#d94f87', acc: 'earring' },
      traits: { warmth: 0.5, humor: 'goofy', ambition: 0.65, drama: 0.85, confidence: 0.9, loyalty: 0.45, open: 0.6 },
      likes: ['fashion', 'music', 'movies'], dislikes: ['games', 'science'],
      hoops: { skill: 0.4, spots: ['ft'], trash: ['Don\'t make it weird.'] },
      sched: { morning: { hall: 4 }, lunch: 'theater', after: { drama: 2, mall: 2, diner: 1 }, day: { mall: 3, diner: 1 }, night: { party: 4 } },
      voice: { love: ['Obsessed. '], dislike: ['Ew. ', 'Um, no. '] },
      secret: { recall: 'the Marcus thing', text: 'Sofia says she\'s going to break up with Marcus after the Snow Ball. "For the pictures."', short: 'Sofia plans to dump Marcus after the dance' } },
    { id: 'maya', name: 'Maya Thompson', first: 'Maya', pro: 'she', clique: 'art',
      bio: 'Paints, skates, and has opinions about your music.',
      look: { skin: '#8d5524', hair: '#0f0b08', style: 'locs', shirt: '#3f7f6e' },
      traits: { warmth: 0.45, humor: 'dry', ambition: 0.5, drama: 0.25, confidence: 0.6, loyalty: 0.8, open: 0.6 },
      likes: ['art', 'music', 'skating'], dislikes: ['fashion', 'sports'],
      hoops: { skill: 0.5, spots: ['lb', 'rb'], trash: ['Whatever.', 'Lucky.'] },
      sched: { morning: { courtyard: 4, hall: 1 }, lunch: 'art', after: { art: 3, park: 1, diner: 1 }, day: { park: 2, mall: 1 }, night: { movies: 1, home: 2, party: 1 } },
      voice: { love: ['Okay, respect. '], dislike: ['Hm. ', 'No. '] },
      secret: { recall: 'the gallery', text: 'Maya sold a painting to a gallery in Beacon. She doesn\'t want anyone at school to know.', short: 'Maya sold a painting to a gallery' } },
    { id: 'darnell', name: 'Darnell Brooks', first: 'Darnell', pro: 'he', clique: 'art',
      bio: 'Class clown. Works at the Starlight Cinema. Plays pickup like it\'s the playoffs.',
      look: { skin: '#5c3a1e', hair: '#0f0b08', style: 'buzz', shirt: '#e3b23c' },
      traits: { warmth: 0.85, humor: 'goofy', ambition: 0.3, drama: 0.5, confidence: 0.7, loyalty: 0.8, open: 0.4 },
      likes: ['games', 'food', 'movies'], dislikes: ['books', 'fashion'],
      hoops: { skill: 0.64, spots: ['lbk', 'rbk', 'le', 're'], trash: ['Glass!', 'Old man game.', 'Money.'] },
      sched: { morning: { hall: 2, gym: 1 }, lunch: 'art', after: { park: 3, job: 2 }, day: { job: 2, park: 2 }, night: { movies: 2, party: 1 } },
      voice: { love: ['AYYY. ', 'Yo! '], dislike: ['Oof. '] },
      secret: { recall: "my mom's job", text: 'Darnell is picking up extra shifts because his mom lost her job. He jokes about everything except that.', short: 'Darnell\'s family is short on money' } }
  ];
  const BY_ID = Object.fromEntries(CAST.map(c => [c.id, c]));

  // Starting friendships between them (−100..100). Everyone else starts near zero.
  const BONDS = {
    'marcus|sofia': 55, 'marcus|hannah': 45, 'marcus|tyler': 5, 'tyler|darnell': 30, 'hannah|tyler': -12,
    'jordan|sofia': 65, 'jordan|maya': 40, 'priya|eli': 60, 'maya|darnell': 45, 'eli|hannah': 6,
    'priya|sofia': -22, 'darnell|jordan': 30, 'hannah|priya': 20, 'eli|darnell': 25
  };
  const COUPLES = [['marcus', 'sofia']];
  // pairs that could end up dating as the semester goes
  const SPARKS = [['marcus', 'hannah'], ['priya', 'eli'], ['jordan', 'maya'], ['tyler', 'sofia'], ['darnell', 'maya'], ['eli', 'hannah'], ['priya', 'tyler'], ['jordan', 'darnell']];

  // ---------- places ----------
  // stat: what spending the block here builds; cost: energy
  const PLACES = {
    hall: { name: 'Hallway', blurb: 'Lockers, noise, everybody passing through.', stat: { charm: 1 }, cost: 3, act: 'Hang by your locker' },
    gym: { name: 'Gym', blurb: 'Balls bouncing before first bell.', stat: { athletics: 2 }, cost: 10, act: 'Shoot around', hoops: true },
    library: { name: 'Library', blurb: 'Quiet, warm, smells like old carpet.', stat: { smarts: 2 }, cost: 8, act: 'Study', grade: 2 },
    courtyard: { name: 'Courtyard', blurb: 'Picnic tables, sketchbooks, someone\'s speaker.', stat: { creativity: 2 }, cost: 4, act: 'Sketch for a while' },
    sleep: { name: 'Sleep in', blurb: 'Twenty more minutes. Maybe forty.', stat: {}, cost: -22, act: 'Sleep in', solo: true },
    lunch_jocks: { name: 'Jock table', blurb: 'Loud. Protein bars. Somebody\'s always arm wrestling.', stat: { athletics: 1 }, cost: 0, act: 'Eat', table: 'jocks' },
    lunch_theater: { name: 'Theater table', blurb: 'Half the table is singing.', stat: { creativity: 1 }, cost: 0, act: 'Eat', table: 'theater' },
    lunch_brains: { name: 'Robotics table', blurb: 'Flashcards next to the tater tots.', stat: { smarts: 1 }, cost: 0, act: 'Eat', table: 'brains' },
    lunch_art: { name: 'Art kids table', blurb: 'Sketchbooks, sharpies, a skateboard under every chair.', stat: { creativity: 1 }, cost: 0, act: 'Eat', table: 'art' },
    lunch_alone: { name: 'Eat alone', blurb: 'Headphones in, book open.', stat: { smarts: 1 }, cost: -6, act: 'Read and eat', solo: true },
    practice: { name: 'Practice', blurb: 'Coach Dwyer\'s whistle. Suicides if you\'re late.', stat: { athletics: 3 }, cost: 18, act: 'Run the drills', hoops: true, team: true },
    drama: { name: 'Drama club', blurb: 'Rehearsal for the winter one-acts.', stat: { creativity: 2, charm: 1 }, cost: 10, act: 'Run lines' },
    robotics: { name: 'Robotics lab', blurb: 'The robot\'s name is Gerald. Gerald is on fire again.', stat: { smarts: 2, creativity: 1 }, cost: 10, act: 'Work on Gerald' },
    art: { name: 'Art room', blurb: 'Ms. Okafor leaves it open until five.', stat: { creativity: 3 }, cost: 8, act: 'Paint' },
    park: { name: 'Delaney Park courts', blurb: 'Chain nets, double rims, whoever\'s got next.', stat: { athletics: 2 }, cost: 12, act: 'Run pickup', hoops: true, outdoor: true },
    diner: { name: 'Rosie\'s Diner', blurb: 'Disco fries, bottomless coffee, a booth by the window.', stat: { charm: 1 }, cost: -4, act: 'Get disco fries', money: -6 },
    job: { name: 'Starlight Cinema', blurb: 'Popcorn duty. Free movies on Tuesdays.', stat: {}, cost: 16, act: 'Work a shift', money: 24 },
    mall: { name: 'Galleria', blurb: 'The food court is the whole point.', stat: { charm: 1 }, cost: 6, act: 'Walk around', money: -8 },
    library_w: { name: 'Library', blurb: 'Saturday hours, nobody else here.', stat: { smarts: 2 }, cost: 6, act: 'Study', grade: 3 },
    home: { name: 'Home', blurb: 'Your room. Your rules.', stat: {}, cost: -16, act: 'Recharge', solo: true },
    homework: { name: 'Homework', blurb: 'Kitchen table, lamp on.', stat: { smarts: 2 }, cost: 10, act: 'Do homework', grade: 4, solo: true },
    gaming: { name: 'Play video games', blurb: 'One more round. Fine, five.', stat: {}, cost: -10, mood: 8, act: 'Play', solo: true, online: 'eli' },
    phone: { name: 'Text somebody', blurb: 'Lie on the floor and text.', stat: { charm: 1 }, cost: 2, act: 'Text', solo: true, texting: true },
    sleep_early: { name: 'Sleep early', blurb: 'In bed by ten like a responsible person.', stat: {}, cost: -30, act: 'Sleep', solo: true },
    party: { name: 'Party at Sofia\'s', blurb: 'Her parents are in Montauk.', stat: { charm: 2 }, cost: 14, mood: 10, act: 'Go to the party', invite: true },
    movies: { name: 'Starlight Cinema', blurb: 'Whatever\'s playing at nine.', stat: {}, cost: 4, mood: 6, act: 'See a movie', money: -10 }
  };
  const SLOTS = {
    school: [
      { id: 'morning', label: 'Before school', places: ['hall', 'gym', 'library', 'courtyard', 'sleep'] },
      { id: 'lunch', label: 'Lunch', places: ['lunch_jocks', 'lunch_theater', 'lunch_brains', 'lunch_art', 'lunch_alone'] },
      { id: 'after', label: 'After school', places: ['practice', 'drama', 'robotics', 'art', 'park', 'diner', 'job', 'home'] },
      { id: 'evening', label: 'Tonight', places: ['homework', 'phone', 'gaming', 'sleep_early'] }
    ],
    weekend: [
      { id: 'day', label: 'Daytime', places: ['park', 'mall', 'diner', 'job', 'library_w', 'home'] },
      { id: 'night', label: 'Tonight', places: ['party', 'movies', 'phone', 'gaming', 'sleep_early'] }
    ]
  };
  const SCHED_KEY = { hall: 'morning', gym: 'morning', library: 'morning', courtyard: 'morning', practice: 'after', drama: 'after', robotics: 'after', art: 'after', park: 'after', diner: 'after', job: 'after', home: 'after', mall: 'day' };

  // ---------- classes ----------
  const CLASSES = [
    { id: 'math', name: 'Algebra II', teacher: 'Mr. Petrakis', game: 'algebra' },
    { id: 'chem', name: 'Chemistry', teacher: 'Ms. Alvarez', game: 'titration' },
    { id: 'hist', name: 'U.S. History', teacher: 'Mr. Harlan', game: 'timeline' },
    { id: 'eng', name: 'English', teacher: 'Ms. Greer', game: 'proofread' },
    { id: 'pe', name: 'Gym class', teacher: 'Coach Dwyer', game: 'freethrows' }
  ];
  const ART_CLASS = { id: 'art', name: 'Studio Art', teacher: 'Ms. Okafor', game: 'sketch' };

  // ---------- basketball season ----------
  const OPPONENTS = [
    { week: 3, name: 'Riverside', mascot: 'Rapids', strength: 0.35 },
    { week: 4, name: 'Millbrook', mascot: 'Mustangs', strength: 0.5 },
    { week: 5, name: 'Kingsbridge Prep', mascot: 'Knights', strength: 0.7, rival: true },
    { week: 6, name: 'Highland', mascot: 'Huskies', strength: 0.5 },
    { week: 7, name: 'St. Anselm', mascot: 'Saints', strength: 0.65 },
    { week: 8, name: 'Kingsbridge Prep', mascot: 'Knights', strength: 0.75, rival: true, final: true }
  ];

  // ---------- conversation ----------
  const LINES = {
    ask: {
      love: ['Okay, you actually want to know? I could talk about {topic} all day.', 'Finally somebody asks. {Topic} is my whole thing.', 'Oh, you\'re getting the full lecture on {topic} now.'],
      like: ['Yeah, I\'m into {topic}. You?', '{Topic}? Sure, I\'ve got thoughts.', 'Kind of, yeah. Are you?'],
      meh: ['Eh. {Topic}\'s fine, I guess.', 'Not really my thing, but okay.', 'I don\'t think about {topic} that much.'],
      dislike: ['{Topic}? Hard pass.', 'Can we talk about literally anything else?', 'Why does everyone ask me about {topic}?'],
      hate: ['Do I look like I care about {topic}?', 'Wow. No.', 'You really don\'t know me at all, huh.']
    },
    share: {
      love: ['Wait, you\'re into {topic} too? Okay, we\'re friends now.', 'No way. Tell me everything.'],
      like: ['Huh, cool. I like {topic} too.', 'Okay, that\'s actually interesting.'],
      meh: ['Mm-hm.', 'Cool, cool.', 'That\'s... a lot of {topic}.'],
      dislike: ['Oh. You\'re one of those {topic} people.', 'I\'m going to be honest, I tuned out.'],
      hate: ['Please stop talking about {topic}.', 'I could not care less.']
    },
    joke: {
      love: ['Okay, that actually got me.', 'Stop. STOP. I can\'t breathe.', 'Who knew you were funny?'],
      like: ['Ha. Okay, decent.', 'That\'s pretty good.', '*snorts*'],
      meh: ['Was that a joke?', 'Sure.', 'I get it. I don\'t love it, but I get it.'],
      dislike: ['Yikes.', 'Read the room.', 'That was rough.'],
      hate: ['Not funny. At all.', 'Seriously? Right now?']
    },
    compliment: {
      love: ['Wait, really? That\'s... thanks. Nobody says that.', 'Okay, you just made my whole day.'],
      like: ['Ha, thanks. Appreciate it.', 'Oh, stop. Don\'t stop.'],
      meh: ['Uh, thanks?', 'Okay...'],
      dislike: ['What do you want?', 'That\'s a weird thing to say.'],
      hate: ['Don\'t butter me up.', 'Kind of creepy, but thanks.']
    },
    vent: {
      love: ['RIGHT? Thank you. I thought it was just me.', 'Don\'t get me started. Okay, I\'m started.'],
      like: ['Yeah, it\'s a lot.', 'Honestly, same.'],
      meh: ['It\'s not that bad.', 'I mean, it\'s school.'],
      dislike: ['Complaining doesn\'t really fix anything.', 'Kind of a downer, no offense.'],
      hate: ['I really don\'t need the negativity today.']
    },
    gossip: {
      love: ['WHAT. No. Tell me everything.', 'I KNEW it. I knew something was going on.'],
      like: ['Huh. Interesting.', 'Wait, seriously?'],
      meh: ['Okay.', 'Not really my business.'],
      dislike: ['Why are you telling me this?', 'I don\'t really do gossip.'],
      hate: ['That\'s messed up. You shouldn\'t be spreading that.', 'I can\'t believe you\'d say that about them.']
    },
    remember: {
      love: ['Ha, I still think about that.', 'That was the best. We have to do that again.'],
      like: ['Yeah, that was fun.'], meh: ['Oh, right. Yeah.'], dislike: ['I\'d rather not.'], hate: ['Why would you bring that up?']
    },
    apologize: {
      love: ['...Okay. Thanks for saying that. We\'re good.', 'I appreciate that. Really.'],
      like: ['Yeah. Okay. We\'re cool.'], meh: ['Fine.'], dislike: ['Words are cheap.'], hate: ['Too late for that.']
    },
    flirt: {
      love: ['Smooth. Keep going.', 'Oh, is that right?', 'You\'re kind of cute when you try.'],
      like: ['Ha. Cute.', 'Okay, okay. I see you.'],
      meh: ['Uh, ha. Okay.', 'Was that a line?'],
      dislike: ['Let\'s keep it friends.', 'That\'s not... no.'],
      hate: ['I\'m seeing someone. You know that, right?', 'Absolutely not.']
    },
    listen: {
      love: ['Thanks for actually listening. Seriously.', 'I needed that. Nobody listens.'],
      like: ['Yeah. Anyway. Thanks.'], meh: ['...Anyway.'], dislike: ['Are you even paying attention?'], hate: ['Forget it.']
    }
  };
  const OPENERS = {
    stranger: ['Hey. You\'re the new kid, right?', 'Uh, hi?', 'Can I help you?'],
    acquaintance: ['Hey, {player}.', 'Oh, hey.', 'What\'s up?'],
    friend: ['{player}! What\'s up?', 'Hey, you.', 'There you are.'],
    close: ['Finally. I was looking for you.', 'My favorite person. What\'s going on?', 'Okay, sit. I have news.'],
    cold: ['Oh. It\'s you.', 'What do you want?', 'Make it quick.'],
    down: ['Not the best day. What\'s up?', 'Ugh. Hi.', 'Don\'t ask how I\'m doing.']
  };
  const JOKES = {
    goofy: ['Tell the one about the cafeteria pizza', 'Do your Coach Dwyer impression', 'Pretend the vending machine owes you money'],
    dry: ['Deadpan about Mr. Harlan\'s slideshow', 'Say this hallway is a fire code violation', 'Rate the lunch like a food critic']
  };
  const VENTS = ['Complain about Mr. Harlan\'s slideshows', 'Complain about the homework load', 'Complain about the 7:25 bell', 'Complain about the cafeteria pizza'];
  const COMPLIMENTS = ['Compliment their style', 'Tell them they\'re funny', 'Say they\'re good at what they do'];

  // ---------- autonomous life: things that happen to them without you ----------
  const LIFE_EVENTS = [
    { id: 'aced', p: 0.025, when: n => n.traits.ambition > 0.6, text: '{a} aced the {cls} test. Curved the whole class.', mood: 0.4 },
    { id: 'failed', p: 0.02, when: n => n.traits.ambition < 0.7, text: '{a} bombed the {cls} test and is pretending they didn\'t.', mood: -0.4 },
    { id: 'car', p: 0.008, when: n => n.likes.includes('cars') || n.traits.confidence > 0.8, text: '{a} got their license. Already dented the mailbox.', mood: 0.3 },
    { id: 'phone', p: 0.012, when: () => true, text: '{a} dropped their phone in the pool at the Y. RIP.', mood: -0.2 },
    { id: 'sick', p: 0.015, when: () => true, text: '{a} was out sick. Rumor says "sick."', mood: -0.1 },
    { id: 'detention', p: 0.012, when: n => n.traits.ambition < 0.6 || n.traits.confidence > 0.85, text: '{a} got detention for something involving a fire extinguisher.', mood: -0.2 },
    { id: 'solo', p: 0.01, when: n => n.clique === 'theater', text: '{a} got the solo in the winter showcase.', mood: 0.5 }
  ];

  // ---------- microgame content ----------
  const HISTORY = [
    ['Magna Carta sealed', 1215], ['Columbus reaches the Caribbean', 1492], ['Henry Hudson sails up the Hudson', 1609], ['Declaration of Independence', 1776],
    ['French Revolution begins', 1789], ['Lewis and Clark set out', 1804], ['Erie Canal opens', 1825], ['Gettysburg Address', 1863], ['Wright brothers fly', 1903],
    ['Treaty of Versailles', 1919], ['19th Amendment ratified', 1920], ['Pearl Harbor attacked', 1941], ['World War II ends', 1945], ['Jackie Robinson debuts', 1947],
    ['Brown v. Board of Education', 1954], ['Moon landing', 1969], ['Berlin Wall falls', 1989], ['First iPhone', 2007], ['Printing press in Europe', 1440], ['Fall of the Western Roman Empire', 476]
  ];
  const PROOF = [
    ['The team was definately ready for the game.', 'definately'], ['She recieved a letter from the college.', 'recieved'], ['We need to seperate the eggs first.', 'seperate'],
    ['That was the wierd part of the movie.', 'wierd'], ['His arguement made no sense at all.', 'arguement'], ['They went to the libary after practice.', 'libary'],
    ['The concert was truely amazing.', 'truely'], ['I will begin tommorow morning.', 'tommorow'], ['The goverment passed a new law.', 'goverment'],
    ['Our neighbor has a beautifull garden.', 'beautifull'], ['It was an embarassing moment for everyone.', 'embarassing'], ['The coach gave us a calender of games.', 'calender'],
    ['Please aknowledge the email by Friday.', 'aknowledge'], ['That is a rediculous excuse.', 'rediculous'], ['The weather was untill noon perfect.', 'untill'],
    ['My freind lives across the river.', 'freind'], ['We have a reccomendation for you.', 'reccomendation'], ['The occassion called for a speech.', 'occassion']
  ];

  return { TOPICS, CAST, BY_ID, BONDS, COUPLES, SPARKS, PLACES, SLOTS, SCHED_KEY, CLASSES, ART_CLASS, OPPONENTS, LINES, OPENERS, JOKES, VENTS, COMPLIMENTS, LIFE_EVENTS, HISTORY, PROOF };
})();
