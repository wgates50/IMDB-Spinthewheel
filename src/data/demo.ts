import type { WatchlistItem } from "@/lib/types";

interface Seed {
  id: string;
  title: string;
  year: number;
  type: string;
  rating: number;
  votes: number;
  runtime: number;
  genres: string;
}

/**
 * A stand-in watchlist so the wheel is usable before anything is imported.
 * Ratings are point-in-time snapshots and will drift from IMDb — the real
 * numbers arrive with your own export.
 */
const SEEDS: Seed[] = [
  { id: "tt0111161", title: "The Shawshank Redemption", year: 1994, type: "movie", rating: 9.3, votes: 2900000, runtime: 142, genres: "Drama" },
  { id: "tt0068646", title: "The Godfather", year: 1972, type: "movie", rating: 9.2, votes: 2050000, runtime: 175, genres: "Crime, Drama" },
  { id: "tt0468569", title: "The Dark Knight", year: 2008, type: "movie", rating: 9.0, votes: 2900000, runtime: 152, genres: "Action, Crime, Drama" },
  { id: "tt0110912", title: "Pulp Fiction", year: 1994, type: "movie", rating: 8.9, votes: 2200000, runtime: 154, genres: "Crime, Drama" },
  { id: "tt0109830", title: "Forrest Gump", year: 1994, type: "movie", rating: 8.8, votes: 2250000, runtime: 142, genres: "Drama, Romance" },
  { id: "tt1375666", title: "Inception", year: 2010, type: "movie", rating: 8.8, votes: 2600000, runtime: 148, genres: "Action, Adventure, Sci-Fi" },
  { id: "tt0133093", title: "The Matrix", year: 1999, type: "movie", rating: 8.7, votes: 2050000, runtime: 136, genres: "Action, Sci-Fi" },
  { id: "tt0816692", title: "Interstellar", year: 2014, type: "movie", rating: 8.7, votes: 2100000, runtime: 169, genres: "Adventure, Drama, Sci-Fi" },
  { id: "tt6751668", title: "Parasite", year: 2019, type: "movie", rating: 8.5, votes: 950000, runtime: 132, genres: "Drama, Thriller" },
  { id: "tt0114369", title: "Se7en", year: 1995, type: "movie", rating: 8.6, votes: 1750000, runtime: 127, genres: "Crime, Drama, Mystery" },
  { id: "tt0245429", title: "Spirited Away", year: 2001, type: "movie", rating: 8.6, votes: 830000, runtime: 125, genres: "Animation, Adventure, Family" },
  { id: "tt0027977", title: "Modern Times", year: 1936, type: "movie", rating: 8.5, votes: 260000, runtime: 87, genres: "Comedy, Drama, Romance" },
  { id: "tt0088763", title: "Back to the Future", year: 1985, type: "movie", rating: 8.5, votes: 1300000, runtime: 116, genres: "Adventure, Comedy, Sci-Fi" },
  { id: "tt7286456", title: "Joker", year: 2019, type: "movie", rating: 8.4, votes: 1500000, runtime: 122, genres: "Crime, Drama, Thriller" },
  { id: "tt0361748", title: "Inglourious Basterds", year: 2009, type: "movie", rating: 8.4, votes: 1600000, runtime: 153, genres: "Adventure, Drama, War" },
  { id: "tt2582802", title: "Whiplash", year: 2014, type: "movie", rating: 8.5, votes: 1000000, runtime: 106, genres: "Drama, Music" },
  { id: "tt15398776", title: "Oppenheimer", year: 2023, type: "movie", rating: 8.3, votes: 850000, runtime: 181, genres: "Biography, Drama, History" },
  { id: "tt1745960", title: "Top Gun: Maverick", year: 2022, type: "movie", rating: 8.2, votes: 720000, runtime: 130, genres: "Action, Drama" },
  { id: "tt0903747", title: "Breaking Bad", year: 2008, type: "tvSeries", rating: 9.5, votes: 2100000, runtime: 49, genres: "Crime, Drama, Thriller" },
  { id: "tt0417299", title: "Avatar: The Last Airbender", year: 2005, type: "tvSeries", rating: 9.3, votes: 380000, runtime: 23, genres: "Animation, Action, Adventure" },
  { id: "tt7366338", title: "Chernobyl", year: 2019, type: "tvMiniSeries", rating: 9.3, votes: 900000, runtime: 330, genres: "Drama, History, Thriller" },
  { id: "tt0306414", title: "The Wire", year: 2002, type: "tvSeries", rating: 9.3, votes: 400000, runtime: 59, genres: "Crime, Drama, Thriller" },
  { id: "tt5491994", title: "Planet Earth II", year: 2016, type: "tvMiniSeries", rating: 9.4, votes: 165000, runtime: 298, genres: "Documentary" },
  { id: "tt2861424", title: "Rick and Morty", year: 2013, type: "tvSeries", rating: 9.1, votes: 620000, runtime: 23, genres: "Animation, Adventure, Comedy" },
  { id: "tt0386676", title: "The Office", year: 2005, type: "tvSeries", rating: 9.0, votes: 750000, runtime: 22, genres: "Comedy" },
  { id: "tt2707408", title: "Narcos", year: 2015, type: "tvSeries", rating: 8.8, votes: 460000, runtime: 49, genres: "Biography, Crime, Drama" },
  { id: "tt1520211", title: "The Walking Dead", year: 2010, type: "tvSeries", rating: 8.1, votes: 1100000, runtime: 44, genres: "Drama, Horror, Thriller" },
  { id: "tt4574334", title: "Stranger Things", year: 2016, type: "tvSeries", rating: 8.6, votes: 1400000, runtime: 51, genres: "Drama, Fantasy, Horror" },
];

export const DEMO_WATCHLIST: WatchlistItem[] = SEEDS.map((seed) => {
  const isTv = seed.type.startsWith("tv");
  return {
    id: seed.id,
    title: seed.title,
    year: seed.year,
    titleType: isTv ? (seed.type === "tvMiniSeries" ? "TV Mini Series" : "TV Series") : "Movie",
    category: isTv ? "tv" : "movie",
    imdbRating: seed.rating,
    numVotes: seed.votes,
    runtime: seed.runtime,
    genres: seed.genres.split(",").map((genre) => genre.trim()),
    directors: [],
    url: `https://www.imdb.com/title/${seed.id}/`,
    addedAt: null,
    releaseDate: null,
  };
});
