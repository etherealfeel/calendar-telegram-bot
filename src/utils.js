function formatDate(dateString) {
  const date = new Date(dateString);

  // Format the date parts
  const year = date.getFullYear();
  const month = date.toLocaleString('uk-UA', { month: 'short' });
  const day = date.getDate();

  // Format the time parts
  let hours = date.getHours();
  let minutes = date.getMinutes();
  minutes = minutes < 10 ? '0' + minutes : minutes;

  // Construct the formatted date and time string
  const formattedDate = `${day} ${month}, ${year}`;
  const formattedTime = `${hours}:${minutes}`;

  return `${formattedDate} о ${formattedTime}`;
}

module.exports = formatDate;