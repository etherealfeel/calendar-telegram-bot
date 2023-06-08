function formatDate(dateString, endTime = false) {
  const date = new Date(dateString);

  // Format the date parts
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();

  // Format the time parts
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12 for 12-hour format
  minutes = minutes < 10 ? '0' + minutes : minutes;

  // Construct the formatted date and time string
  const formattedDate = `${month} ${day}, ${year}`;
  const formattedTime = `${hours}:${minutes} ${ampm}`;

  return endTime ? `${formattedTime}` : `${formattedDate} at ${formattedTime}`;
}

module.exports = formatDate;