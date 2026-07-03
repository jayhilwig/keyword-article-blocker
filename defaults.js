// defaults.js
const KAB_DEFAULT_RULES = [
  {
    id: "person_trump",
    enabled: false,
    label: "Donald Trump",
    type: "preset",
    patterns: [
      "Trump",
      "Donald Trump",
      "President Trump",
      "Trump administration",
      "POTUS Trump",
    ],
  },
  {
    id: "person_biden",
    enabled: false,
    label: "Joe Biden",
    type: "preset",
    patterns: [
      "Biden",
      "Joe Biden",
      "President Biden",
      "Biden administration",
      "POTUS Biden",
    ],
  },
  {
    id: "person_obama",
    enabled: false,
    label: "Barack Obama",
    type: "preset",
    patterns: [
      "Obama",
      "Barack Obama",
      "President Obama",
      "Obama administration",
    ],
  },
  {
    id: "person_bush",
    enabled: false,
    label: "George W. Bush",
    type: "preset",
    patterns: [
      "Bush",
      "George Bush",
      "George W. Bush",
      "President Bush",
      "Bush administration",
    ],
  },
  {
    id: "person_clinton",
    enabled: false,
    label: "Bill Clinton",
    type: "preset",
    patterns: [
      "Clinton",
      "Bill Clinton",
      "President Clinton",
      "Clinton administration",
    ],
  },
  {
    id: "topic_conflicts",
    enabled: false,
    label: "Global conflicts",
    type: "preset",
    patterns: ["Gaza", "Ukraine", "Russia", "Putin", "NATO", "sanctions"],
  },
  {
    id: "topic_us_figures",
    enabled: false,
    label: "Major US political figures",
    type: "preset",
    patterns: [
      "Kamala Harris",
      "Nancy Pelosi",
      "Mitch McConnell",
      "Gavin Newsom",
      "Ron DeSantis",
      "Alexandria Ocasio-Cortez",
      "AOC",
      "Ted Cruz",
    ],
  },
  {
    id: "topic_breaking",
    enabled: false,
    label: "Breaking & crisis news",
    type: "preset",
    patterns: [
      "breaking news",
      "live updates",
      "crisis",
      "emergency",
      "disaster",
    ],
  },
];

const KAB_STORAGE_KEYS = {
  RULES: "kab_rules",
  DISABLED_SITES: "kab_disabled_sites",
};
