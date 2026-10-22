// 30 days, 30 AI ideas.
// Add one entry per day, in order, then push. The grid, the counter and the
// detail view all come from this list.
//
//   title    short name of the idea
//   summary  the post text, pasted as-is between backticks (blank line = new paragraph)
//   image    optional, e.g. "ideas/01.png" (any aspect ratio, it's cropped to 4:3)
//   x        link to the post on X

window.IDEAS = {
  handle: 'thisisjaeha',
  start: '2026-10-22', // date of day 01 as "YYYY-MM-DD"; null shows "starting soon"
  list: [
    {
      title: 'how do you make an AI creative like a human?',
      summary: `make it imitate invention itself.
pretrain on everything written before the airplane. fine-tune it to come up with the airplane. move the cutoff forward and do it again, for every invention up to today.

the answer is always something it hasn't read. before 1903 it knows balloons and gliders and gets told "powered airplane". after that the airplane is old news and the cutoff moves on. so the only thing it can learn is the jump to the next thing.

then ask it what's next`,
      image: 'ideas/01.jpg',
      x: 'https://x.com/thisisjaeha/status/2113207162486898829',
    },
  ],
};
