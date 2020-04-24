import * as qs from 'qs';
import { ipcRenderer } from 'electron'; // eslint-disable-line import/no-extraneous-dependencies
import { fromJS } from 'immutable';
import { Contract } from '@emeraldplatform/contracts';
import { screen } from '@emeraldwallet/store';
import { onceServicesStart, onceAccountsLoaded, onceBalancesSet } from '../triggers';


const protocolLinkHandler = (request, state, dispatch) => {
  const paymentParams = qs.parse(request.url.split('?')[1]);
  const abi = [paymentParams.functionSignature];
  const contract = new Contract(abi);

  const contractCallArgs = { data: null, typedData: null };

  const isContractFunction = paymentParams.mode && paymentParams.mode === 'contract_function';
  if (isContractFunction) {
    const args = {};
    paymentParams.argsDefaults.forEach((i) => {
      args[i.name] = i.value;
    });
    contractCallArgs.data = contract.functionToData(paymentParams.functionSignature.name, args) || undefined;
    contractCallArgs.typedData = {
      name: paymentParams.functionSignature.name,
      argsDefaults: paymentParams.argsDefaults,
    };
  }

  const isContractConstructor = paymentParams.mode && paymentParams.mode === 'contract_constructor';

  if (isContractConstructor) {
    contractCallArgs.data = paymentParams.data;
  }

  const transaction = fromJS({
    amount: paymentParams.value,
    gas: paymentParams.gas,
    mode: paymentParams.mode,
    ...contractCallArgs,
  });

  const toAccount = fromJS({ id: paymentParams.to });
  const accounts = state.accounts.get('accounts');

  let fromAccount = accounts.first();
  if (paymentParams.from) {
    fromAccount = accounts.find((account) => account.get('id') === paymentParams.from) || fromAccount;
  }

  dispatch(screen.actions.gotoScreen('repeat-tx', { transaction, toAccount, fromAccount }));
};

export function startProtocolListener(store) {
  ipcRenderer.on('protocol', (event, request) => {
    onceServicesStart(store)
      .then(() => onceAccountsLoaded(store))
      .then(() => onceBalancesSet(store))
      .then(() => protocolLinkHandler(request, store.getState(), store.dispatch));
  });
}
