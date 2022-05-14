function enableMainControls() {

  let mainControl = document.getElementById('main-control');
  let currentSelected = document.getElementById('mc-text');
  let subSelect = document.getElementById('sub-select');
  let optionTexts = document.getElementsByClassName('option-text');

  [].forEach.call(optionTexts, (optionText) => {
    optionText.addEventListener('click', () => {
      currentSelected.textContent = optionText.children[0].textContent;
      subSelect.classList.toggle('hide');

      // change all to non active
      [].forEach.call(optionTexts, (optionText2) => {
        optionText2.classList.remove('active-option');
      });

      optionText.classList.add('active-option');
    })
  })

  mainControl.addEventListener('click', () => {
    subSelect.classList.toggle('hide');
  })

}
enableMainControls();